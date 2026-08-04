import { Router, Request, Response } from 'express';

const router = Router();

router.post('/position/open', async (req: Request, res: Response) => {
  try {
    const { symbol, takeProfitPrice, stopLossPrice, side, positionSize, quantity } = req.body;
    if (!symbol || !takeProfitPrice || !stopLossPrice || !side || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const entryPrice = takeProfitPrice;
    const notional = entryPrice * quantity;
    const virtualBalance = 1000000;
    const position = { symbol, side, entryPrice, quantity, notional, takeProfitPrice, stopLossPrice, openedAt: new Date().toISOString() };
    res.json({ balance: virtualBalance, position });
  } catch (error) {
    console.error('Error in /position/open:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;