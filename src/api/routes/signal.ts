import {
  Router,
  Request,
  Response
} from "express";
import { ScalpStrategy } from "../../services/ScalpStrategy";
import { CandleService } from "../../services/CandleService";
import { BotRunner } from "../../services/BotRunner";
import config from "../../config";
import {
  BarIndicators1m,
  BarIndicators5m,
  Candle
} from "../../types";

const router = Router();

const strategy =
  new ScalpStrategy();

const candleService =
  new CandleService();

function getIndicatorsResponse(
  candles1m: Candle[],
  candles5m: Candle[],
  strategyInstance: ScalpStrategy
) {
  const indicators1m =
    strategyInstance.build1mIndicators(
      candles1m
    );

  const indicators5m =
    strategyInstance.build5mIndicators(
      candles5m
    );

  const last1m =
    indicators1m[indicators1m.length - 1];

  const last5m =
    indicators5m[indicators5m.length - 1];

  return {
    atr1m: last1m?.atr1m ?? null,
    atr5m: last5m?.atr5m ?? null,
    vwap1m: last1m?.vwap1m ?? null,
    emaFast5m:
      last5m?.emaFast5m ?? null,
    emaSlow5m:
      last5m?.emaSlow5m ?? null
  };
}

router.post(
  "/bot/run",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const { symbol } = req.body;

      if (!symbol) {
        return res.status(400).json({
          error: "Symbol is required"
        });
      }

      const {
        candles1m,
        candles5m
      } =
        await candleService
          .getCandlesForSignal(
            symbol,
            config.candles1mMinutes,
            config.candles5mMinutes
          );

      if (
        candles1m.length === 0 ||
        candles5m.length === 0
      ) {
        return res.json({
          symbol,
          ready: false,
          signal: null,
          reason: "no_data",
          candlesCount: 0,
          timestamp: Date.now()
        });
      }

      const indicators1m =
        strategy.build1mIndicators(
          candles1m
        );

      const indicators5m =
        strategy.build5mIndicators(
          candles5m
        );

      const signalIndex =
        candles1m.length - 2;

      const decision =
        strategy.evaluateEntry(
          candles1m,
          indicators1m,
          candles5m,
          indicators5m,
          signalIndex
        );

      return res.json({
        symbol,
        ready: true,
        signal:
          decision.signal || null,
        reason: decision.reason,
        indicators:
          getIndicatorsResponse(
            candles1m,
            candles5m,
            strategy
          ),
        candlesCount: candles1m.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(
        "Error in /bot/run:",
        error
      );

      return res.status(500).json({
        error: "Internal server error",
        symbol: req.body.symbol,
        ready: false,
        signal: null,
        timestamp: Date.now()
      });
    }
  }
);

router.post(
  "/market/regime",
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const { symbol } = req.body;

      if (!symbol) {
        return res.status(400).json({
          error: "Symbol is required"
        });
      }

      const candles =
        await candleService.getCandles(
          symbol,
          config.candles1mMinutes,
          "1m"
        );

      if (candles.length === 0) {
        return res.json({
          symbol,
          regime: "no_data",
          ready: false
        });
      }

      const regime =
        strategy.determineRegime(
          candles
        );

      return res.json({
        symbol,
        regime: regime.regime,
        ready: regime.ready
      });
    } catch (error) {
      console.error(
        "Error in /market/regime:",
        error
      );

      return res.status(500).json({
        error: "Internal server error",
        symbol: req.body.symbol,
        regime: "error",
        ready: false
      });
    }
  }
);

export default router;
