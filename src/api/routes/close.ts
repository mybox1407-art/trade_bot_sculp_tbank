import { Router, Request, Response } from "express";
import { positionService } from "../../services/PositionService";
import logger from "../../utils/logger";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { positionId, closePrice, pnl } = req.body;

    if (!positionId || !closePrice || pnl === undefined) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: positionId, closePrice, pnl",
        timestamp: Date.now(),
      });
      return;
    }

    logger.info(`Close position request: ${positionId} @ ${closePrice}, PnL: ${pnl}`);

    const position = positionService.closePosition(positionId, closePrice, pnl);

    if (!position) {
      res.status(404).json({
        success: false,
        error: `Position not found: ${positionId}`,
        timestamp: Date.now(),
      });
      return;
    }

    logger.info(`Position closed: ${positionId}`);
    res.status(200).json({
      success: true,
      position,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    logger.error("Error in close position route:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

export default router;
