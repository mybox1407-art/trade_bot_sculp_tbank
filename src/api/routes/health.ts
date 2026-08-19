import {
  Router,
  Request,
  Response
} from "express";
import botRunner from "../../bot";
import positionService from "../../services/PositionService";

const router = Router();

router.get(
  "/health",
  (
    _req: Request,
    res: Response
  ) => {
    const account =
      positionService.getAccount();

    return res.json({
      ok: true,
      timestamp: Date.now(),
      bot: botRunner.getStatus(),
      account
    });
  }
);

router.post(
  "/bot/start",
  (
    _req: Request,
    res: Response
  ) => {
    try {
      botRunner.start();

      return res.json({
        success: true,
        status:
          botRunner.getStatus()
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start bot"
      });
    }
  }
);

router.post(
  "/bot/stop",
  async (
    _req: Request,
    res: Response
  ) => {
    await botRunner.stop();

    return res.json({
      success: true,
      status:
        botRunner.getStatus()
    });
  }
);

router.get(
  "/bot/status",
  (
    _req: Request,
    res: Response
  ) => {
    return res.json(
      botRunner.getStatus()
    );
  }
);

export default router;
