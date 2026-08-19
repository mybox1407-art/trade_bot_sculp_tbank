import { randomUUID } from "crypto";
import config from "../config";
import {
  AccountState,
  ClosePositionRequest,
  OpenPositionRequest,
  Position,
  ScalpSide
} from "../types";
import logger from "../utils/logger";
import csvLogService from "./CsvLogService";
import telegramService from "./TelegramService";

export class PositionService {
  private readonly positions: Map<
    string,
    Position
  > = new Map();

  private readonly account: AccountState = {
    initialBalance: config.virtualBalance,
    cashBalance: config.virtualBalance,
    realizedPnl: 0,
    totalCommissions: 0,
    updatedAt: Date.now()
  };

  private readonly commissionRate =
    config.commissionRate;

  private readonly slippageRate =
    config.slippageRate;

  getAccount(): AccountState {
    return {
      ...this.account
    };
  }

  getOpenPositions(): Position[] {
    return Array.from(
      this.positions.values()
    ).filter(
      position => position.status === "open"
    );
  }

  getPosition(
    symbol: string
  ): Position | undefined {
    return this.positions.get(symbol);
  }

  getAllPositions(): Position[] {
    return Array.from(
      this.positions.values()
    );
  }

  private applyEntrySlippage(
    side: ScalpSide,
    price: number
  ): number {
    if (side === "long") {
      return price * (1 + this.slippageRate);
    }

    return price * (1 - this.slippageRate);
  }

  private applyExitSlippage(
    side: ScalpSide,
    price: number
  ): number {
    if (side === "long") {
      return price * (1 - this.slippageRate);
    }

    return price * (1 + this.slippageRate);
  }

  openPosition(
    request: OpenPositionRequest
  ): Position {
    const {
      symbol,
      side,
      quantity,
      entryPrice,
      stopLossPrice,
      takeProfitPrice,
      signal
    } = request;

    if (!symbol) {
      throw new Error(
        "Symbol is required"
      );
    }

    if (
      side !== "long" &&
      side !== "short"
    ) {
      throw new Error(
        "Side must be long or short"
      );
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        "Quantity must be positive"
      );
    }

    if (
      !Number.isFinite(entryPrice) ||
      entryPrice <= 0
    ) {
      throw new Error(
        "Entry price must be positive"
      );
    }

    if (this.getPosition(symbol)) {
      throw new Error(
        `Position already exists for ${symbol}`
      );
    }

    const executedEntryPrice =
      this.applyEntrySlippage(
        side,
        entryPrice
      );

    const notional =
      executedEntryPrice * quantity;

    const commissionOpen =
      notional * this.commissionRate;

    if (
      this.account.cashBalance <
      commissionOpen
    ) {
      throw new Error(
        "Insufficient cash balance for commission"
      );
    }

    this.account.cashBalance -=
      commissionOpen;

    this.account.totalCommissions +=
      commissionOpen;

    this.account.updatedAt = Date.now();

    const position: Position = {
      id: randomUUID(),
      symbol,
      side,
      entryPrice: executedEntryPrice,
      stopLossPrice,
      takeProfitPrice,
      quantity,
      notional,
      entryTime: Date.now(),
      status: "open",
      commissionOpen,
      signal
    };

    this.positions.set(symbol, position);

    csvLogService.logPositionOpened(
      position
    );

    csvLogService.logEvent(
      "position_opened",
      symbol,
      `Position opened: ${side}`,
      position
    );

    void telegramService.notifyPositionOpened(
      position
    );

    logger.info(
      `Position opened: ${symbol} ` +
      `${side} @ ${executedEntryPrice}, ` +
      `quantity=${quantity}`
    );

    return {
      ...position
    };
  }

  closePosition(
    request: ClosePositionRequest
  ): Position | undefined {
    const position =
      this.positions.get(request.symbol);

    if (
      !position ||
      position.status !== "open"
    ) {
      return undefined;
    }

    const executedClosePrice =
      this.applyExitSlippage(
        position.side,
        request.closePrice
      );

    const grossPnl =
      position.side === "long"
        ? (
            executedClosePrice -
            position.entryPrice
          ) * position.quantity
        : (
            position.entryPrice -
            executedClosePrice
          ) * position.quantity;

    const notionalExit =
      executedClosePrice *
      position.quantity;

    const commissionClose =
      notionalExit *
      this.commissionRate;

    const pnl =
      grossPnl -
      position.commissionOpen -
      commissionClose;

    position.status =
      request.reason === "stop_loss_hit"
        ? "stopped"
        : "closed";

    position.closePrice =
      executedClosePrice;

    position.closeTime = Date.now();
    position.grossPnl = grossPnl;
    position.pnl = pnl;
    position.commissionClose =
      commissionClose;
    position.closeReason =
      request.reason || "manual";

    this.account.cashBalance +=
      grossPnl - commissionClose;

    this.account.realizedPnl += pnl;

    this.account.totalCommissions +=
      commissionClose;

    this.account.updatedAt = Date.now();

    csvLogService.logPositionClosed(
      position
    );

    csvLogService.logEvent(
      "position_closed",
      position.symbol,
      `Position closed: ${position.closeReason}`,
      position
    );

    void telegramService.notifyPositionClosed({
      symbol: position.symbol,
      side: position.side,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      closePrice: position.closePrice,
      pnl,
      grossPnl,
      commissionOpen: position.commissionOpen,
      commissionClose,
      closeReason: position.closeReason
    });

    logger.info(
      `Position closed: ${position.symbol}, ` +
      `reason=${position.closeReason}, ` +
      `grossPnl=${grossPnl}, pnl=${pnl}`
    );

    return {
      ...position
    };
  }

  checkAndClosePosition(
    symbol: string,
    currentPrice: number,
    now = Date.now()
  ): {
    hasPosition: boolean;
    position?: Position;
    action: "hold" | "close";
    actionReason?:
      | "take_profit_hit"
      | "stop_loss_hit"
      | "time_exit";
    unrealizedPnl?: number;
    closed: boolean;
    realizedPnl?: number;
  } {
    const position =
      this.getPosition(symbol);

    if (
      !position ||
      position.status !== "open"
    ) {
      return {
        hasPosition: false,
        action: "hold",
        closed: false
      };
    }

    const unrealizedPnl =
      position.side === "long"
        ? (
            currentPrice -
            position.entryPrice
          ) * position.quantity
        : (
            position.entryPrice -
            currentPrice
          ) * position.quantity;

    let reason:
      | "take_profit_hit"
      | "stop_loss_hit"
      | "time_exit"
      | undefined;

    if (position.side === "long") {
      if (
        currentPrice >=
        position.takeProfitPrice
      ) {
        reason = "take_profit_hit";
      } else if (
        currentPrice <=
        position.stopLossPrice
      ) {
        reason = "stop_loss_hit";
      }
    } else {
      if (
        currentPrice <=
        position.takeProfitPrice
      ) {
        reason = "take_profit_hit";
      } else if (
        currentPrice >=
        position.stopLossPrice
      ) {
        reason = "stop_loss_hit";
      }
    }

    const timeStopMs =
      config.positionTimeStopMinutes *
      60 *
      1000;

    if (
      !reason &&
      now - position.entryTime >=
        timeStopMs
    ) {
      reason = "time_exit";
    }

    if (!reason) {
      return {
        hasPosition: true,
        position: {
          ...position
        },
        action: "hold",
        unrealizedPnl,
        closed: false
      };
    }

    const closed =
      this.closePosition({
        symbol,
        closePrice: currentPrice,
        reason
      });

    return {
      hasPosition: true,
      position: closed,
      action: "close",
      actionReason: reason,
      unrealizedPnl,
      closed: Boolean(closed),
      realizedPnl: closed?.pnl
    };
  }

  reset(): void {
    this.positions.clear();

    this.account.cashBalance =
      this.account.initialBalance;

    this.account.realizedPnl = 0;
    this.account.totalCommissions = 0;
    this.account.updatedAt = Date.now();
  }
}

export const positionService =
  new PositionService();

export default positionService;
