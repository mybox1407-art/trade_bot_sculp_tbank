export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ScalpSide = "long" | "short";

export type EntryRejectReason =
  | "outside_session"
  | "not_enough_history"
  | "missing_context"
  | "trend_not_aligned"
  | "atr_not_expanding"
  | "volume_too_small"
  | "pullback_too_small"
  | "breakout_missing"
  | "impulse_too_small"
  | "target_too_small_for_costs"
  | "too_far_from_vwap"
  | "no_signal";

export interface ScalpParams {
  riskPerTrade: number;
  maxRiskPerTrade: number;
  commissionRate: number;
  slippageRate: number;
  atrPeriod1m: number;
  atrPeriod5m: number;
  emaFastPeriod5m: number;
  emaSlowPeriod5m: number;
  vwapPeriod1m: number;
  volumeLookback1m: number;
  trendAtrLookback5m: number;
  trendAtrExpandRatio5m: number;
  pullbackLookback1m: number;
  breakoutBufferPct: number;
  minPullbackPct: number;
  minImpulseBodyPct: number;
  volumeMinRatio1m: number;
  atrSlMult: number;
  atrTpMult: number;
  timeStopBars: number;
  cooldownBars: number;
  minTargetMovePct: number;
  minCostCoverage: number;
  maxEntryDistanceFromVwapPct: number;
  maxPositionNotionalPct: number;
  sessionStartHour: number;
  sessionEndHour: number;
}

export interface ScalpSignal {
  side: ScalpSide;
  signalIndex: number;
  entryIndex: number;
  signalTime: number;
  entryTime: number;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  riskDistance: number;
  atr1m: number;
  atr5m: number;
  vwap1m: number;
  impulseBodyPct: number;
  pullbackPct: number;
  volumeRatio: number;
}

export interface EntryDecision {
  accepted: boolean;
  reason?: EntryRejectReason;
  signal?: ScalpSignal;
}

export interface BarIndicators1m {
  atr1m: number | null;
  vwap1m: number | null;
  volumeSma1m: number | null;
}

export interface BarIndicators5m {
  atr5m: number | null;
  atr5mSma: number | null;
  emaFast5m: number | null;
  emaSlow5m: number | null;
  close5m: number | null;
}

export interface Position {
  id: string;
  symbol: string;
  side: ScalpSide;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  quantity: number;
  entryTime: number;
  status: "open" | "closed" | "stopped";
  closePrice?: number;
  closeTime?: number;
  pnl?: number;
  signal?: ScalpSignal;
}

export interface SignalResponse {
  symbol: string;
  signal: ScalpSignal | null;
  reason?: EntryRejectReason;
  indicators: {
    atr1m: number | null;
    atr5m: number | null;
    vwap1m: number | null;
    emaFast5m: number | null;
    emaSlow5m: number | null;
  };
  candlesCount: number;
  timestamp: number;
}

export interface PositionResponse {
  symbol: string;
  positions: Position[];
  totalPnl: number;
  timestamp: number;
}

export interface OpenPositionRequest {
  symbol: string;
  side: ScalpSide;
  quantity: number;
  stopLossPrice: number;
  takeProfitPrice: number;
}

export interface OpenPositionResponse {
  success: boolean;
  position?: Position;
  error?: string;
  timestamp: number;
}
