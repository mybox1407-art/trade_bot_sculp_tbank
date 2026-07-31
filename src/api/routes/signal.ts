import { Router, Request, Response } from "express";
import { candleService } from "../../services/CandleService";
import {
  build1mIndicators,
  build5mIndicators,
  aggregateCandlesTo5m,
  evaluateMomentumScalpEntry,
  DEFAULT_SCALP_PARAMS,
} from "../../services/ScalpStrategy";
import { SignalResponse } from "../../types";
import logger from "../../utils/logger";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.query;

    if (!symbol || typeof symbol !== "string") {
      res.status(400).json({
        success: false,
        error: "Missing or invalid 'symbol' query parameter",
        timestamp: Date.now(),
      } as SignalResponse);
      return;
    }

    logger.info(`Signal check requested for ${symbol}`);

    const { candles1m, candles5m } = await candleService.getCandlesForSignal(symbol);

    if (candles1m.length < 20 || candles5m.length < 10) {
      res.status(200).json({
        success: true,
        symbol,
        signal: null,
        reason: "not_enough_history",
        indicators: { atr1m: null, atr5m: null, vwap1m: null, emaFast5m: null, emaSlow5m: null },
        candlesCount: candles1m.length,
        timestamp: Date.now(),
      });
      return;
    }

    const indicators1m = build1mIndicators(candles1m, DEFAULT_SCALP_PARAMS);
    const candles5mAggregated = aggregateCandlesTo5m(candles1m);
    const indicators5m = build5mIndicators(candles5mAggregated, DEFAULT_SCALP_PARAMS);

    const signalIndex = candles1m.length - 3;
    const decision = evaluateMomentumScalpEntry(
      candles1m,
      indicators1m,
      candles5mAggregated,
      indicators5m,
      signalIndex,
      DEFAULT_SCALP_PARAMS
    );

    const lastInd1m = indicators1m[indicators1m.length - 1];
    const lastInd5m = indicators5m[indicators5m.length - 1];

    const response: SignalResponse = {
      success: true,
      symbol,
      signal: decision.accepted && decision.signal ? decision.signal : null,
      reason: decision.accepted ? undefined : decision.reason,
      indicators: {
        atr1m: lastInd1m?.atr1m ?? null,
        atr5m: lastInd5m?.atr5m ?? null,
        vwap1m: lastInd1m?.vwap1m ?? null,
        emaFast5m: lastInd5m?.emaFast5m ?? null,
        emaSlow5m: lastInd5m?.emaSlow5m ?? null,
      },
      candlesCount: candles1m.length,
      timestamp: Date.now(),
    };

    logger.info(`Signal for ${symbol}: ${decision.accepted ? decision.signal?.side : decision.reason}`);
    res.status(200).json(response);
  } catch (error: any) {
    logger.error("Error in signal route:", error);
    res.status(500).json({
      success: false,
      symbol: req.query.symbol as string,
      signal: null,
      error: error.message,
      timestamp: Date.now(),
    });
  }
});

export default router;
