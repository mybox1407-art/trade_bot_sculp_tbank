import { v4 as uuidv4 } from "uuid";
import { Position, ScalpSide, ScalpSignal } from "../types";
import logger from "../utils/logger";

export class PositionService {
  private positions: Map<string, Position> = new Map();

  createPosition(
    symbol: string,
    side: ScalpSide,
    entryPrice: number,
    stopLossPrice: number,
    takeProfitPrice: number,
    quantity: number,
    signal?: ScalpSignal
  ): Position {
    const id = uuidv4();
    const position: Position = {
      id,
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
    this.positions.set(id, position);
    logger.info(`Position created: ${id} | ${symbol} ${side} @ ${entryPrice}`);
    return position;
  }

  getPosition(id: string): Position | undefined {
    return this.positions.get(id);
  }

  getPositionsBySymbol(symbol: string): Position[] {
    return Array.from(this.positions.values()).filter((p) => p.symbol === symbol && p.status === "open");
  }

  getAllOpenPositions(): Position[] {
    return Array.from(this.positions.values()).filter((p) => p.status === "open");
  }

  updatePosition(id: string, updates: Partial<Position>): Position | undefined {
    const position = this.positions.get(id);
    if (!position) {
      logger.warn(`Position not found: ${id}`);
      return undefined;
    }
    const updated = { ...position, ...updates };
    this.positions.set(id, updated);
    logger.info(`Position updated: ${id}`);
    return updated;
  }

  closePosition(id: string, closePrice: number, pnl: number): Position | undefined {
    return this.updatePosition(id, {
      status: "closed",
      closePrice,
      pnl,
      closeTime: Date.now(),
    });
  }

  stopPosition(id: string, closePrice: number, pnl: number): Position | undefined {
    return this.updatePosition(id, {
      status: "stopped",
      closePrice,
      pnl,
      closeTime: Date.now(),
    });
  }

  deletePosition(id: string): boolean {
    const deleted = this.positions.delete(id);
    if (deleted) {
      logger.info(`Position deleted: ${id}`);
    }
    return deleted;
  }

  clearClosedPositions(): void {
    const openPositions = Array.from(this.positions.entries()).filter(
      ([_, p]) => p.status === "open"
    );
    this.positions = new Map(openPositions);
    logger.info("Cleared closed positions");
  }
}

export const positionService = new PositionService();
export default positionService;
