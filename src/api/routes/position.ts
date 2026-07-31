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

    // Если есть currentPrice — проверяем TP/SL
    if (currentPrice && typeof currentPrice === "string") {
      const price = parseFloat(currentPrice);
      const result = positionService.checkPosition(symbol, price);

      logger.info(`Position check ${symbol}: action=${result.action}`);
      res.status(200).json(result);
    } else {
      // Просто проверка есть ли позиция
      const position = positionService.getPosition(symbol);
      res.status(200).json({
        hasPosition: !!position,
        position: position || null,
      });
    }
  } catch (error: any) {
    logger.error("Error in position route:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
