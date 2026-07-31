import { Router, Request, Response } from "express";
import { positionService } from "../../services/PositionService";
import { OpenPositionRequest, OpenPositionResponse, ScalpSide } from "../../types";
import logger from "../../utils/logger";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { symbol, side, quantity, stopLossPrice, takeProfitPrice, entryPrice } = req.body;

    if (!symbol || !side || !quantity || !stopLossPrice || !takeProfitPrice || !entryPrice) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: symbol, side, quantity, stopLossPrice, takeProfitPrice, entryPrice",
        timestamp: Date.now(),
      });
      return;
    }

    if (side !== "long" && side !== "short") {
      res.status(400).json({
        success: false,
        error: "Invalid side. Must be 'long' or 'short'",
        timestamp: Date.now(),
      });
      return;
    }

    logger.info(`Open position request: ${symbol} ${side} qty=${quantity} @ ${entryPrice}`);

    const position = positionService.createPosition(
      symbol,
      side as ScalpSide,
      entryPrice,
      stopLossPrice,
      takeProfitPrice,
      quantity
    );

    const response: OpenPositionResponse = {
      success: true,
      position,
      timestamp: Date.now(),
    };

    logger.info(`Position opened: ${position.id}`);
    res.status(201).json(response);
  } catch (error: any) {
    logger.error("Error in open position route:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

export default router;
