import { Router } from "express";
import signalRouter from "./routes/signal";
import positionRouter from "./routes/position";
import openRouter from "./routes/open";

const router = Router();

router.use("/signal", signalRouter);
router.use("/position", positionRouter);
router.use("/open", openRouter);

export default router;
