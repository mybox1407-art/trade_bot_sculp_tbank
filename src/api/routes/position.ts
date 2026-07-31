import { Router, Request, Response } from "express";
import { positionService } from "../../services/PositionService";
import { PositionResponse } from "../../types";
import logger from "../../utils/logger";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.query;

    if (symbol && typeof symbol === "string") {
      const positions = positionService.getPositionsBySymbol(symbol);
      const totalPnl = positions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);

      const response: PositionResponse = {
        symbol,
        positions,
        totalPnl,
        timestamp: Date.now(),
      };

      logger.info(`Position check for ${symbol}: ${positions.length} open`);
      res.status(200).json(response);
    } else {
      const allPositions = positionService.getAllOpenPositions();
      const totalPnl = allPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);

      const response: PositionResponse = {
        symbol: "ALL",
        positions: allPositions,
        totalPnl,
        timestamp: Date.now(),
      };

      logger.info(`Position check ALL: ${allPositions.length} open`);
      res.status(200).json(response);
    }
  } catch (error: any) {
    logger.error("Error in position route:", error);
    res.status(500).json({
      symbol: (req.query.symbol as string) || "ALL",
      positions: [],
      totalPnl: 0,
      timestamp: Date.now(),
    });
  }
});

export default router;
