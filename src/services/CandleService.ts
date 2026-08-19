import { Candle } from "../types";
import tbankClient from "../utils/tbank";
import logger from "../utils/logger";

export class CandleService {
  private cache: Map<
    string,
    {
      candles: Candle[];
      timestamp: number;
    }
  > = new Map();

  private readonly CACHE_TTL_MS =
    20 * 1000;

  async getCandles(
    figi: string,
    minutes = 100,
    interval: "1m" | "5m" = "1m"
  ): Promise<Candle[]> {
    const cacheKey =
      `${figi}_${interval}_${minutes}`;

    const cached =
      this.cache.get(cacheKey);

    const now = Date.now();

    if (
      cached &&
      now - cached.timestamp <
        this.CACHE_TTL_MS
    ) {
      logger.debug(
        `Cache hit for ${cacheKey}`
      );

      return cached.candles;
    }

    logger.info(
      `Fetching ${interval} candles for ${figi}`
    );

    const to = new Date();
    const from = new Date(
      to.getTime() -
      minutes * 60 * 1000
    );

    try {
      const candles =
        await tbankClient.getCandles(
          figi,
          from,
          to,
          interval
        );

      const normalized = this.normalizeCandles(
        candles
      );

      this.cache.set(cacheKey, {
        candles: normalized,
        timestamp: now
      });

      logger.debug(
        `Cached ${normalized.length} candles ` +
        `for ${cacheKey}`
      );

      return normalized;
    } catch (error) {
      logger.error(
        `Failed to fetch candles for ${figi}:`,
        error
      );

      throw error;
    }
  }

  async getCandlesForSignal(
    figi: string,
    interval1m = 500,
    interval5m = 1000
  ): Promise<{
    candles1m: Candle[];
    candles5m: Candle[];
  }> {
    const [
      candles1m,
      candles5m
    ] = await Promise.all([
      this.getCandles(
        figi,
        interval1m,
        "1m"
      ),
      this.getCandles(
        figi,
        interval5m,
        "5m"
      )
    ]);

    return {
      candles1m,
      candles5m
    };
  }

  private normalizeCandles(
    candles: Candle[]
  ): Candle[] {
    const byTime = new Map<
      number,
      Candle
    >();

    for (const candle of candles) {
      if (
        !Number.isFinite(candle.time) ||
        !Number.isFinite(candle.open) ||
        !Number.isFinite(candle.high) ||
        !Number.isFinite(candle.low) ||
        !Number.isFinite(candle.close) ||
        !Number.isFinite(candle.volume)
      ) {
        continue;
      }

      byTime.set(candle.time, candle);
    }

    return Array.from(byTime.values())
      .sort((a, b) => a.time - b.time);
  }

  invalidateCache(
    figi?: string
  ): void {
    if (figi) {
      const keys = Array.from(
        this.cache.keys()
      ).filter(key =>
        key.startsWith(`${figi}_`)
      );

      for (const key of keys) {
        this.cache.delete(key);
      }

      logger.info(
        `Invalidated cache for ${figi}`
      );
    } else {
      this.cache.clear();
      logger.info(
        "Cleared all candle cache"
      );
    }
  }
}

export const candleService =
  new CandleService();

export default candleService;
