import { Router, Request, Response } from "express";
import { positionService } from "../../services/PositionService";
import { ScalpSide } from "../../types";
import logger from "../../utils/logger";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { symbol, side, quantity, stopLossPrice, takeProfitPrice, entryPrice } = req.body;

    if (!symbol || !side || !quantity || !stopLossPrice || !takeProfitPrice || !entryPrice) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    logger.info(`Open position: ${symbol} ${side} @ ${entryPrice}`);

    const position = positionService.openPosition(
      symbol,
      side as ScalpSide,
      entryPrice,
      stopLossPrice,
      takeProfitPrice,
      quantity
    );

    res.status(201).json({
      success: true,
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    logger.error("Error opening position:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
