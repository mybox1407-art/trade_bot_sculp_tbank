import {
  Router,
  Request,
  Response
} from "express";
import positionService from "../../services/PositionService";

const router = Router();

router.post(
  "/position/open",
  (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        symbol,
        side,
        quantity,
        entryPrice,
        takeProfitPrice,
        stopLossPrice,
        signal
      } = req.body;

      if (
        !symbol ||
        !side ||
        !Number.isFinite(
          Number(quantity)
        ) ||
        !Number.isFinite(
          Number(entryPrice)
        ) ||
        !Number.isFinite(
          Number(takeProfitPrice)
        ) ||
        !Number.isFinite(
          Number(stopLossPrice)
        )
      ) {
        return res.status(400).json({
          error: "Invalid position fields"
        });
      }

      const position =
        positionService.openPosition({
          symbol,
          side,
          quantity: Number(quantity),
          entryPrice: Number(entryPrice),
          takeProfitPrice:
            Number(takeProfitPrice),
          stopLossPrice:
            Number(stopLossPrice),
          signal
        });

      return res.status(201).json({
        success: true,
        position,
        account:
          positionService.getAccount(),
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(
        "Error in /position/open:",
        error
      );

      return res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to open position"
      });
    }
  }
);

export default router;
