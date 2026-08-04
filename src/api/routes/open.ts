import { Router, Request, Response } from 'express';

const router = Router();

let virtualBalance = 1000000;
const COMMISSION_RATE = 0.0005;

router.post('/position/open', async (req: Request, res: Response) => {
  try {
    const { symbol, takeProfitPrice, stopLossPrice, side, positionSize, quantity, entryPrice } = req.body;
    if (!symbol || !takeProfitPrice || !stopLossPrice || !side || !quantity || !entryPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notional = entryPrice * quantity;
    const commissionOpen = notional * COMMISSION_RATE;
    const balanceBefore = virtualBalance;
    const balanceAfter = balanceBefore - commissionOpen;
    
    virtualBalance = balanceAfter;

    const position = {
      symbol,
      side,
      entryPrice,
      quantity,
      notional,
      takeProfitPrice,
      stopLossPrice,
      openedAt: new Date().toISOString(),
      commissionOpen
    };

    res.json({ 
      balance: balanceAfter, 
      balanceBefore,
      position,
      commissionOpen 
    });
  } catch (error) {
    console.error('Error in /position/open:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;