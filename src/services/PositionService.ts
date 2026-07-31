import { Position, ScalpSide, ScalpSignal } from "../types";
import logger from "../utils/logger";

export class PositionService {
  // Храним ТОЛЬКО одну позицию на symbol
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
      id: symbol,  // symbol как id
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

  closePosition(
    symbol: string,
    closePrice: number,
    pnl: number
  ): Position | undefined {
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

  checkPosition(
    symbol: string,
    currentPrice: number
  ): {
    hasPosition: boolean;
    position?: Position;
    action: "hold" | "close";
    actionReason?: "take_profit_hit" | "stop_loss_hit" | "time_exit";
    unrealizedPnl?: number;
  } {
    const position = this.positions.get(symbol);

    if (!position || position.status !== "open") {
      return { hasPosition: false, action: "hold" };
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

    // Проверка TP/SL
    if (position.side === "long") {
      if (currentPrice >= tp) {
        return {
          hasPosition: true,
          position,
          action: "close",
          actionReason: "take_profit_hit",
          unrealizedPnl,
        };
      }
      if (currentPrice <= sl) {
        return {
          hasPosition: true,
          position,
          action: "close",
          actionReason: "stop_loss_hit",
          unrealizedPnl,
        };
      }
    } else {
      if (currentPrice <= tp) {
        return {
          hasPosition: true,
          position,
          action: "close",
          actionReason: "take_profit_hit",
          unrealizedPnl,
        };
      }
      if (currentPrice >= sl) {
        return {
          hasPosition: true,
          position,
          action: "close",
          actionReason: "stop_loss_hit",
          unrealizedPnl,
        };
      }
    }

    // Time-based exit (опционально)
    const holdTimeMin = (Date.now() - position.entryTime) / 1000 / 60;
    if (holdTimeMin > 30) {  // 30 минут макс
      return {
        hasPosition: true,
        position,
        action: "close",
        actionReason: "time_exit",
        unrealizedPnl,
      };
    }

    return {
      hasPosition: true,
      position,
      action: "hold",
      unrealizedPnl,
    };
  }
}

export const positionService = new PositionService();
export default positionService;
