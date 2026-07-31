import { Position, ScalpSide, ScalpSignal } from "../types";
import logger from "../utils/logger";

export class PositionService {
  private positions: Map<string, Position> = new Map();

  openPosition(
    symbol: string,
    side: ScalpSide,
    entryPrice: number,
    stopLossPrice: number,
    takeProfitPrice: number,
    quantity: number,
    signal?: ScalpSignal
  ): Position {
    const position: Position = {
      id: symbol,
      symbol,
      side,
      entryPrice,
      stopLossPrice,
      takeProfitPrice,
      quantity,
      entryTime: Date.now(),
      status: "open",
      signal,
    };

    this.positions.set(symbol, position);
    logger.info(`Position opened: ${symbol} ${side} @ ${entryPrice}`);
    return position;
  }

  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  closePosition(symbol: string, closePrice: number, pnl: number): Position | undefined {
    const position = this.positions.get(symbol);
    if (!position) {
      logger.warn(`No position to close for ${symbol}`);
      return undefined;
    }

    position.status = "closed";
    position.closePrice = closePrice;
    position.pnl = pnl;
    position.closeTime = Date.now();

    logger.info(`Position closed: ${symbol} PnL=${pnl}`);
    return position;
  }

  checkAndClosePosition(
    symbol: string,
    currentPrice: number
  ): {
    hasPosition: boolean;
    position?: Position;
    action: "hold" | "close";
    actionReason?: "take_profit_hit" | "stop_loss_hit" | "time_exit";
    unrealizedPnl?: number;
    closed: boolean;
    realizedPnl?: number;
  } {
    const position = this.positions.get(symbol);

    if (!position || position.status !== "open") {
      return { hasPosition: false, action: "hold", closed: false };
    }

    const entryPrice = position.entryPrice;
    const sl = position.stopLossPrice;
    const tp = position.takeProfitPrice;

    let unrealizedPnl = 0;
    if (position.side === "long") {
      unrealizedPnl = (currentPrice - entryPrice) * position.quantity;
    } else {
      unrealizedPnl = (entryPrice - currentPrice) * position.quantity;
    }

    let action: "hold" | "close" = "hold";
    let actionReason: "take_profit_hit" | "stop_loss_hit" | "time_exit" | undefined;

    // Проверка TP/SL
    if (position.side === "long") {
      if (currentPrice >= tp) {
        action = "close";
        actionReason = "take_profit_hit";
      } else if (currentPrice <= sl) {
        action = "close";
        actionReason = "stop_loss_hit";
      }
    } else {
      if (currentPrice <= tp) {
        action = "close";
        actionReason = "take_profit_hit";
      } else if (currentPrice >= sl) {
        action = "close";
        actionReason = "stop_loss_hit";
      }
    }

    // Time-based exit (опционально)
    if (action === "hold") {
      const holdTimeMin = (Date.now() - position.entryTime) / 1000 / 60;
      if (holdTimeMin > 30) {
        action = "close";
        actionReason = "time_exit";
      }
    }

    // Если надо закрывать — закрываем
    if (action === "close") {
      this.closePosition(symbol, currentPrice, unrealizedPnl);
      return {
        hasPosition: true,
        position,
        action: "close",
        actionReason,
        unrealizedPnl,
        closed: true,
        realizedPnl: unrealizedPnl,
      };
    }

    return {
      hasPosition: true,
      position,
      action: "hold",
      unrealizedPnl,
      closed: false,
    };
  }
}

export const positionService = new PositionService();
export default positionService;
