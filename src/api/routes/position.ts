import { Router, Request, Response } from 'express';

const router = Router();

router.post('/position/check-close', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });
    // Paper trading: пока всегда возвращаем "none"
    // В будущем можно добавить эмуляцию TP/SL
    res.json({ action: 'none', result: { balance: 1000000, lastClosedTrade: null } });
  } catch (error) {
    console.error('Error in /position/check-close:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;