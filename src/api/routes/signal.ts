import { Router, Request, Response } from 'express';
import { ScalpStrategy } from '../../services/ScalpStrategy';
import { CandleService } from '../../services/CandleService';
import { Config } from '../../config';

const router = Router();
const scalpStrategy = new ScalpStrategy();
const candleService = new CandleService();
const config = Config.getInstance();

router.post('/bot/run', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });
    const candles = await candleService.getCandles(symbol);
    if (!candles || candles.length === 0) {
      return res.json({ symbol, timeframe: config.timeframe, ready: false, price: 0, buy: false, sell: false, side: 'none', regime: 'no_data', positionSize: null, takeProfitPrice: null, stopLossPrice: null, indicators: { lastRsi: null, lastAtr: null, ready: false } });
    }
    const signal = scalpStrategy.calculateSignal(candles, symbol);
    const lastCandle = candles[candles.length - 1];
    const price = lastCandle.close;
    res.json({ symbol, timeframe: config.timeframe, ready: signal.ready, price, buy: signal.buy, sell: signal.sell, side: signal.side, regime: signal.regime, positionSize: signal.positionSize ?? null, takeProfitPrice: signal.takeProfitPrice ?? null, stopLossPrice: signal.stopLossPrice ?? null, indicators: { lastRsi: signal.indicators?.lastRsi ?? null, lastAtr: signal.indicators?.lastAtr ?? null, ready: signal.indicators?.ready ?? false } });
  } catch (error) {
    console.error('Error in /bot/run:', error);
    res.status(500).json({ error: 'Internal server error', symbol: req.body.symbol, ready: false, buy: false, sell: false, side: 'none', regime: 'error', indicators: { ready: false } });
  }
});

router.post('/market/regime', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });
    const candles = await candleService.getCandles(symbol);
    if (!candles || candles.length === 0) return res.json({ symbol, regime: 'no_data', ready: false });
    const regime = scalpStrategy.determineRegime(candles);
    res.json({ symbol, regime: regime.regime, ready: regime.ready });
  } catch (error) {
    console.error('Error in /market/regime:', error);
    res.status(500).json({ error: 'Internal server error', symbol: req.body.symbol, regime: 'error', ready: false });
  }
});

export default router;