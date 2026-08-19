import {
  Router,
  Request,
  Response
} from "express";
import positionService from "../../services/PositionService";

const router = Router();

router.get(
  "/positions",
  (
    _req: Request,
    res: Response
  ) => {
    const positions =
      positionService.getAllPositions();

    const account =
      positionService.getAccount();

    return res.json({
      positions,
      account,
      timestamp: Date.now()
    });
  }
);

router.get(
  "/positions/open",
  (
    _req: Request,
    res: Response
  ) => {
    return res.json({
      positions:
        positionService
          .getOpenPositions(),
      account:
        positionService.getAccount(),
      timestamp: Date.now()
    });
  }
);

router.post(
  "/position/check-close",
  (
    req: Request,
    res: Response
  ) => {
    try {
      const {
        symbol,
        currentPrice
      } = req.body;

      if (
        !symbol ||
        !Number.isFinite(
          Number(currentPrice)
        )
      ) {
        return res.status(400).json({
          error:
            "Symbol and currentPrice are required"
        });
      }

      const result =
        positionService
          .checkAndClosePosition(
            symbol,
            Number(currentPrice)
          );

      return res.json({
        ...result,
        account:
          positionService.getAccount(),
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(
        "Error in /position/check-close:",
        error
      );

      return res.status(500).json({
        error: "Internal server error"
      });
    }
  }
);

export default router;
