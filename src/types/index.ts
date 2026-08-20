export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ScalpSide = "long" | "short";

export type TradingMode =
  | "paper"
  | "live";

export type PositionStatus =
  | "open"
  | "closed"
  | "stopped";

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
  | "invalid_data"
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

  /**
   * Допустимое относительное снижение
   * ATR относительно предыдущего значения.
   *
   * Например, 0.995 означает, что ATR
   * может быть ниже предыдущего максимум
   * на 0.5%.
   */
  atrExpansionTolerance5m: number;

  pullbackLookback1m: number;
  breakoutBufferPct: number;
  minPullbackPct: number;
  minImpulseBodyPct: number;
  volumeMinRatio1m: number;

  minCloseLocationLong?: number;
  maxCloseLocationShort?: number;

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

  sessionTimezone?: "UTC";
  contractMultiplier?: number;

  /**
   * Минимальный размер позиции.
   * Для акций обычно 1 лот или больше.
   */
  minPositionSize?: number;

  /**
   * Шаг количества.
   * Для акций может быть 1.
   */
  positionSizeStep?: number;
}

export interface ScalpSignal {
  side: ScalpSide;

  signalIndex: number;
  entryIndex: number;

  signalTime: number;
  entryTime: number;

  rawEntryPrice?: number;
  triggerPrice?: number;
  entryPrice: number;

  stopLossPrice: number;
  takeProfitPrice: number;

  riskDistance: number;

  atr1m: number;
  atr5m: number;
  vwap1m: number;

  impulseBodyPct: number;
  closeLocation?: number;
  pullbackPct: number;
  volumeRatio: number;

  entryCommissionPct?: number;
  estimatedExitCommissionPct?: number;
  estimatedRoundTripSlippagePct?: number;
  estimatedRoundTripCostPct?: number;
  expectedNetTargetMovePct?: number;
}

export interface EntryDecision {
  accepted: boolean;
  reason?: EntryRejectReason;
  signal?: ScalpSignal;

  /**
   * Диагностические значения фильтров.
   * Например, ATR, SMA ATR и пороги ATR.
   */
  diagnostics?: Record<
    string,
    number | boolean | null
  >;
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
  notional: number;

  entryTime: number;
  status: PositionStatus;

  commissionOpen: number;
  commissionClose?: number;
  slippageOpen?: number;
  slippageClose?: number;

  closePrice?: number;
  closeTime?: number;

  grossPnl?: number;
  pnl?: number;

  closeReason?:
    | "take_profit_hit"
    | "stop_loss_hit"
    | "time_exit"
    | "manual"
    | "error";

  signal?: ScalpSignal;
}

export interface AccountState {
  initialBalance: number;
  cashBalance: number;
  realizedPnl: number;
  totalCommissions: number;
  updatedAt: number;
}

export interface BotState {
  account: AccountState;
  positions: Position[];

  lastSignalBySymbol: Record<
    string,
    number
  >;

  lastProcessedCandleBySymbol: Record<
    string,
    number
  >;

  updatedAt: number;
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

export interface OpenPositionRequest {
  symbol: string;
  side: ScalpSide;
  quantity: number;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  signal?: ScalpSignal;
}

export interface ClosePositionRequest {
  symbol: string;
  closePrice: number;

  reason?:
    | "take_profit_hit"
    | "stop_loss_hit"
    | "time_exit"
    | "manual"
    | "error";
}
