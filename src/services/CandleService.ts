import { Candle } from "../types";
import tbankClient from "../utils/tbank";
import logger from "../utils/logger";

export class CandleService {
  private cache: Map<string, { candles: Candle[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60 * 1000;

  async getCandles(
    figi: string,
    minutes: number = 100,
    interval: "1m" | "5m" = "1m"
  ): Promise<Candle[]> {
    const cacheKey = `${figi}_${interval}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      logger.debug(`Cache hit for ${cacheKey}`);
      return cached.candles;
    }

    logger.info(`Fetching ${interval} candles for ${figi}`);
    const to = new Date();
    const from = new Date(to.getTime() - minutes * 60 * 1000);

    try {
      const candles = await tbankClient.getCandles(figi, from, to, interval);
      this.cache.set(cacheKey, { candles, timestamp: now });
      logger.debug(`Cached ${candles.length} candles for ${cacheKey}`);
      return candles;
    } catch (error) {
      logger.error(`Failed to fetch candles for ${figi}:`, error);
      throw error;
    }
  }

  async getCandlesForSignal(figi: string, interval1m: number = 100, interval5m: number = 500): Promise<{ candles1m: Candle[]; candles5m: Candle[] }> {
    const [candles1m, candles5m] = await Promise.all([
      this.getCandles(figi, interval1m, "1m"),
      this.getCandles(figi, interval5m, "5m"),
    ]);
    return { candles1m, candles5m };
  }

  invalidateCache(figi?: string): void {
    if (figi) {
      const keys = Array.from(this.cache.keys()).filter((k) => k.startsWith(figi));
      keys.forEach((k) => this.cache.delete(k));
      logger.info(`Invalidated cache for ${figi}`);
    } else {
      this.cache.clear();
      logger.info("Cleared all candle cache");
    }
  }
}

export const candleService = new CandleService();
export default candleService;
