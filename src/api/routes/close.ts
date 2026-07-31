import { Router, Request, Response } from "express";
import { positionService } from "../../services/PositionService";
import logger from "../../utils/logger";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { symbol, closePrice, pnl } = req.body;

    if (!symbol || !closePrice || pnl === undefined) {
      res.status(400).json({ error: "Missing symbol, closePrice, or pnl" });
      return;
    }

    logger.info(`Close position: ${symbol} @ ${closePrice} PnL=${pnl}`);

    const position = positionService.closePosition(symbol, closePrice, pnl);

    if (!position) {
      res.status(404).json({ error: `No position for ${symbol}` });
      return;
    }

    res.status(200).json({
      success: true,
      symbol,
      closed: true,
      pnl,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    logger.error("Error closing position:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
