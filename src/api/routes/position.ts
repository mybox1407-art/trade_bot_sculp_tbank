import { Router, Request, Response } from 'express';

const router = Router();

const COMMISSION_RATE = 0.0005;
const openPositions = new Map();

router.post('/position/check-close', async (req: Request, res: Response) => {
  try {
    const { symbol, currentPrice } = req.body;
    if (!symbol || !currentPrice) return res.status(400).json({ error: 'Symbol and currentPrice required' });

    const position = openPositions.get(symbol);
    if (!position) return res.json({ action: 'none', result: { balance: 1000000, lastClosedTrade: null } });

    const { side, entryPrice, quantity, takeProfitPrice, stopLossPrice, commissionOpen } = position;
    let reason = null;

    if (side === 'long') {
      if (currentPrice >= takeProfitPrice) reason = 'tp';
      else if (currentPrice <= stopLossPrice) reason = 'sl';
    } else if (side === 'short') {
      if (currentPrice <= takeProfitPrice) reason = 'tp';
      else if (currentPrice >= stopLossPrice) reason = 'sl';
    }

    if (!reason) return res.json({ action: 'none', result: { balance: 1000000, lastClosedTrade: null } });

    const notionalExit = currentPrice * quantity;
    const commissionClose = notionalExit * COMMISSION_RATE;
    const grossPnL = (currentPrice - entryPrice) * quantity * (side === 'long' ? 1 : -1);
    const realizedPnL = grossPnL - commissionOpen - commissionClose;

    openPositions.delete(symbol);

    const closedTrade = { symbol, side, exitPrice: currentPrice, closedAt: new Date().toISOString(), reason, realizedPnL, commissionOpen, commissionClose };

    res.json({ action: 'closed', result: { balance: 1000000 + realizedPnL, lastClosedTrade: closedTrade } });
  } catch (error) {
    console.error('Error in /position/check-close:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/position/open', async (req: Request, res: Response) => {
  try {
    const { symbol, takeProfitPrice, stopLossPrice, side, positionSize, quantity, entryPrice } = req.body;
    if (!symbol || !takeProfitPrice || !stopLossPrice || !side || !quantity || !entryPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notional = entryPrice * quantity;
    const commissionOpen = notional * COMMISSION_RATE;
    const balanceBefore = 1000000;
    const balanceAfter = balanceBefore - commissionOpen;

    const position = { symbol, side, entryPrice, quantity, notional, takeProfitPrice, stopLossPrice, openedAt: new Date().toISOString(), commissionOpen };

    openPositions.set(symbol, position);

    res.json({ balance: balanceAfter, balanceBefore, position, commissionOpen });
  } catch (error) {
    console.error('Error in /position/open:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;