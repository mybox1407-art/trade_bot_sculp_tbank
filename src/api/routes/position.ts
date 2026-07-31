import { Router, Request, Response } from "express";
import { positionService } from "../../services/PositionService";
import logger from "../../utils/logger";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { symbol, currentPrice } = req.query;

    if (!symbol || typeof symbol !== "string") {
      res.status(400).json({ error: "Missing symbol" });
      return;
    }

    // Если нет currentPrice — просто проверка
    if (!currentPrice || typeof currentPrice !== "string") {
      const position = positionService.getPosition(symbol);
      res.status(200).json({
        hasPosition: !!position,
        position: position || null,
        timestamp: Date.now(),
      });
      return;
    }

    // Есть currentPrice — проверяем TP/SL и закрываем если нужно
    const price = parseFloat(currentPrice);
    const result = positionService.checkAndClosePosition(symbol, price);

    logger.info(
      `Position check ${symbol}: action=${result.action}, closed=${result.closed}`
    );

    res.status(200).json({
      ...result,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    logger.error("Error in position route:", error);
    res.status(500).json({ error: error.message, timestamp: Date.now() });
  }
});

export default router;
