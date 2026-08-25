import { ATR, EMA, SMA } from "technicalindicators";
import config from "../config";
import tbankClient from "../utils/tbank";

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
  atrExpansionTolerance5m: number;

  pullbackLookback1m: number;
  breakoutBufferPct: number;
  minPullbackPct: number;
  minImpulseBodyPct: number;
  volumeMinRatio1m: number;

  minCloseLocationLong: number;
  maxCloseLocationShort: number;

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

  minPositionSize?: number;
  positionSizeStep?: number;
}

export interface ScalpSignal {
  side: ScalpSide;

  signalIndex: number;
  entryIndex: number;

  signalTime: number;
  entryTime: number;

  rawEntryPrice: number;
  triggerPrice: number;
  entryPrice: number;

  stopLossPrice: number;
  takeProfitPrice: number;

  riskDistance: number;

  atr1m: number;
  atr5m: number;
  vwap1m: number;

  impulseBodyPct: number;
  closeLocation: number;
  pullbackPct: number;
  volumeRatio: number;

  entryCommissionPct: number;
  estimatedExitCommissionPct: number;
  estimatedRoundTripSlippagePct: number;
  estimatedRoundTripCostPct: number;
  expectedNetTargetMovePct: number;
}

export interface EntryChecks {
  atrNotLow: boolean | null;
  atrNotSharplyContracting: boolean | null;
  atrAboveTrend: boolean | null;
  atrTrendThresholdPassed: boolean | null;
  atrPassed: boolean | null;
  volumePassed: boolean | null;
  impulseBodyPassed: boolean | null;
  vwapDistancePassed: boolean | null;
  trendPassed: boolean | null;
  directionalImpulsePassed: boolean | null;
  pullbackPassed: boolean | null;
  breakoutPassed: boolean | null;
  targetPassed: boolean | null;
}

export interface EntryDecision {
  accepted: boolean;
  reason?: EntryRejectReason;
  signal?: ScalpSignal;
  checks?: EntryChecks;
  failedChecks?: string[];
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

export interface PositionSizeInput {
  equity: number;
  entryPrice: number;
  stopPrice: number;
  riskPerTrade: number;
  maxRiskPerTrade: number;
  maxPositionNotionalPct: number;
  commissionRate?: number;
  contractMultiplier?: number;
  minPositionSize?: number;
  positionSizeStep?: number;
}

export interface RegimeResult {
  regime:
    | "bullish"
    | "bearish"
    | "flat"
    | "not_ready"
    | "no_data";
  ready: boolean;
}

export interface LegacySignalResult {
  ready: boolean;
  buy: boolean;
  sell: boolean;
  side: ScalpSide | "none";
  regime: RegimeResult["regime"];
  positionSize?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  signal?: ScalpSignal | null;
  reason?: EntryRejectReason;
  indicators?: {
    lastRsi?: number | null;
    lastAtr?: number | null;
    atr1m?: number | null;
    atr5m?: number | null;
    vwap1m?: number | null;
    emaFast5m?: number | null;
    emaSlow5m?: number | null;
    ready?: boolean;
  };
}

export const DEFAULT_SCALP_PARAMS: ScalpParams = {
  riskPerTrade: 0.005,
  maxRiskPerTrade: 0.005,

  commissionRate: 0.0002,
  slippageRate: 0.00015,

  atrPeriod1m: 14,
  atrPeriod5m: 14,
  emaFastPeriod5m: 9,
  emaSlowPeriod5m: 20,
  vwapPeriod1m: 60,
  volumeLookback1m: 60,

  trendAtrLookback5m: 2,
  trendAtrExpandRatio5m: 1.005,
  atrExpansionTolerance5m: 0.95,

  pullbackLookback1m: 6,
  breakoutBufferPct: 0.00015,
  minPullbackPct: 0.0006,
  minImpulseBodyPct: 0.0006,
  volumeMinRatio1m: 1,

  minCloseLocationLong: 0.65,
  maxCloseLocationShort: 0.35,

  atrSlMult: 1.15,
  atrTpMult: 2.0,
  timeStopBars: 16,
  cooldownBars: 4,

  minTargetMovePct: 0.002,
  minCostCoverage: 2.0,
  maxEntryDistanceFromVwapPct: 0.008,
  maxPositionNotionalPct: 0.2,

  sessionStartHour: 10,
  sessionEndHour: 18.75,

  sessionTimezone: "UTC",
  contractMultiplier: 1,

  minPositionSize: 1,
  positionSizeStep: 1
};

function isFinitePositive(
  value: number | null | undefined
): value is number {
  return (
    value !== null &&
    value !== undefined &&
    Number.isFinite(value) &&
    value > 0
  );
}

function validateCandle(
  candle: Candle
): boolean {
  return (
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume) &&
    candle.open > 0 &&
    candle.close > 0 &&
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close &&
    candle.volume >= 0
  );
}

function validateCandles(
  candles: Candle[]
): boolean {
  for (let i = 0; i < candles.length; i++) {
    if (!validateCandle(candles[i])) {
      return false;
    }

    if (
      i > 0 &&
      candles[i].time <= candles[i - 1].time
    ) {
      return false;
    }
  }

  return true;
}

function padSeries(
  values: number[],
  totalLength: number
): Array<number | null> {
  const result: Array<number | null> =
    Array(totalLength).fill(null);

  const firstIndex =
    totalLength - values.length;

  for (let i = 0; i < values.length; i++) {
    const targetIndex =
      firstIndex + i;

    if (
      targetIndex >= 0 &&
      targetIndex < totalLength
    ) {
      result[targetIndex] = values[i];
    }
  }

  return result;
}

function alignDerivedSeries(
  values: number[],
  firstIndex: number,
  totalLength: number
): Array<number | null> {
  const result: Array<number | null> =
    Array(totalLength).fill(null);

  for (let i = 0; i < values.length; i++) {
    const index = firstIndex + i;

    if (
      index >= 0 &&
      index < totalLength
    ) {
      result[index] = values[i];
    }
  }

  return result;
}

function buildAtrSeries(
  candles: Candle[],
  period: number
): Array<number | null> {
  const result: Array<number | null> =
    Array(candles.length).fill(null);

  if (candles.length <= period) {
    return result;
  }

  const atrRaw = ATR.calculate({
    high: candles.map(
      candle => candle.high
    ),
    low: candles.map(
      candle => candle.low
    ),
    close: candles.map(
      candle => candle.close
    ),
    period
  });

  return alignDerivedSeries(
    atrRaw,
    period,
    candles.length
  );
}

function mergeBucket(
  bucket: Candle[],
  bucketStart: number
): Candle {
  const first = bucket[0];
  const last =
    bucket[bucket.length - 1];

  let high = first.high;
  let low = first.low;
  let volume = 0;

  for (const candle of bucket) {
    high = Math.max(high, candle.high);
    low = Math.min(low, candle.low);
    volume += candle.volume;
  }

  return {
    time: bucketStart,
    open: first.open,
    high,
    low,
    close: last.close,
    volume
  };
}

function isComplete5mBucket(
  bucket: Candle[],
  bucketStart: number
): boolean {
  if (bucket.length !== 5) {
    return false;
  }

  for (let i = 0; i < 5; i++) {
    const expectedTime =
      bucketStart + i * 60 * 1000;

    if (
      bucket[i].time !== expectedTime
    ) {
      return false;
    }
  }

  return true;
}

export function aggregateCandlesTo5m(
  candles: Candle[],
  dropIncompleteBuckets = true
): Candle[] {
  const result: Candle[] = [];

  if (
    candles.length === 0 ||
    !validateCandles(candles)
  ) {
    return result;
  }

  let bucket: Candle[] = [];
  let currentBucketStart:
    | number
    | null = null;

  const flushBucket = (): void => {
    if (
      bucket.length > 0 &&
      currentBucketStart !== null &&
      (
        !dropIncompleteBuckets ||
        isComplete5mBucket(
          bucket,
          currentBucketStart
        )
      )
    ) {
      result.push(
        mergeBucket(
          bucket,
          currentBucketStart
        )
      );
    }
  };

  for (const candle of candles) {
    const bucketStart =
      Math.floor(
        candle.time /
          (5 * 60 * 1000)
      ) *
      (5 * 60 * 1000);

    if (
      currentBucketStart === null ||
      bucketStart !== currentBucketStart
    ) {
      flushBucket();

      bucket = [candle];
      currentBucketStart = bucketStart;
    } else {
      bucket.push(candle);
    }
  }

  flushBucket();

  return result;
}

export function build1mIndicators(
  candles: Candle[],
  params: ScalpParams =
    DEFAULT_SCALP_PARAMS
): BarIndicators1m[] {
  if (!validateCandles(candles)) {
    return candles.map(() => ({
      atr1m: null,
      vwap1m: null,
      volumeSma1m: null
    }));
  }

  const atrSeries = buildAtrSeries(
    candles,
    params.atrPeriod1m
  );

  const volumeSmaRaw = SMA.calculate({
    period: params.volumeLookback1m,
    values: candles.map(
      candle => candle.volume
    )
  });

  const volumeSmaSeries =
    padSeries(
      volumeSmaRaw,
      candles.length
    );

  const typicalPrices = candles.map(
    candle =>
      (candle.high +
        candle.low +
        candle.close) /
      3
  );

  const indicators: BarIndicators1m[] =
    [];

  for (
    let index = 0;
    index < candles.length;
    index++
  ) {
    const start = Math.max(
      0,
      index - params.vwapPeriod1m + 1
    );

    let priceVolume = 0;
    let totalVolume = 0;

    for (
      let j = start;
      j <= index;
      j++
    ) {
      priceVolume +=
        typicalPrices[j] *
        candles[j].volume;

      totalVolume += candles[j].volume;
    }

    indicators.push({
      atr1m: atrSeries[index],
      vwap1m:
        totalVolume > 0
          ? priceVolume / totalVolume
          : null,
      volumeSma1m:
        volumeSmaSeries[index]
    });
  }

  return indicators;
}

export function build5mIndicators(
  candles5m: Candle[],
  params: ScalpParams =
    DEFAULT_SCALP_PARAMS
): BarIndicators5m[] {
  if (!validateCandles(candles5m)) {
    return candles5m.map(() => ({
      atr5m: null,
      atr5mSma: null,
      emaFast5m: null,
      emaSlow5m: null,
      close5m: null
    }));
  }

  const closes = candles5m.map(
    candle => candle.close
  );

  const atrSeries = buildAtrSeries(
    candles5m,
    params.atrPeriod5m
  );

  const atrValues: number[] = [];
  const atrIndexes: number[] = [];

  for (
    let index = 0;
    index < atrSeries.length;
    index++
  ) {
    const value = atrSeries[index];

    if (isFinitePositive(value)) {
      atrValues.push(value);
      atrIndexes.push(index);
    }
  }

  const atrSmaRaw = SMA.calculate({
    period: params.trendAtrLookback5m,
    values: atrValues
  });

  const atrSmaSeries: Array<number | null> =
    Array(candles5m.length).fill(null);

  if (
    atrSmaRaw.length > 0 &&
    atrIndexes.length >=
      params.trendAtrLookback5m
  ) {
    const firstAtrSmaIndex =
      atrIndexes[
        params.trendAtrLookback5m - 1
      ];

    const firstAtrSmaRawIndex =
      atrIndexes.indexOf(
        firstAtrSmaIndex
      );

    for (
      let i = 0;
      i < atrSmaRaw.length;
      i++
    ) {
      const atrValueIndex =
        firstAtrSmaRawIndex + i;

      const candleIndex =
        atrIndexes[atrValueIndex];

      if (
        candleIndex !== undefined &&
        candleIndex >= 0 &&
        candleIndex < candles5m.length
      ) {
        atrSmaSeries[candleIndex] =
          atrSmaRaw[i];
      }
    }
  }

  const emaFastRaw = EMA.calculate({
    period: params.emaFastPeriod5m,
    values: closes
  });

  const emaSlowRaw = EMA.calculate({
    period: params.emaSlowPeriod5m,
    values: closes
  });

  const emaFastSeries = padSeries(
    emaFastRaw,
    candles5m.length
  );

  const emaSlowSeries = padSeries(
    emaSlowRaw,
    candles5m.length
  );

  return candles5m.map(
    (_candle, index) => ({
      atr5m: atrSeries[index],
      atr5mSma:
        atrSmaSeries[index],
      emaFast5m:
        emaFastSeries[index],
      emaSlow5m:
        emaSlowSeries[index],
      close5m: closes[index]
    })
  );
}

export function map1mIndexToClosed5mIndex(
  candleTime: number,
  candles5m: Candle[]
): number {
  if (candles5m.length === 0) {
    return -1;
  }

  const currentBucketStart =
    Math.floor(
      candleTime /
        (5 * 60 * 1000)
    ) *
    (5 * 60 * 1000);

  const lastClosedBucketStart =
    currentBucketStart -
    5 * 60 * 1000;

  let left = 0;
  let right = candles5m.length - 1;
  let answer = -1;

  while (left <= right) {
    const middle =
      Math.floor(
        (left + right) / 2
      );

    if (
      candles5m[middle].time <=
      lastClosedBucketStart
    ) {
      answer = middle;
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  return answer;
}

function getHourFractionUtc(
  time: number
): number {
  const date = new Date(time);

  return (
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600
  );
}

function inSession(
  time: number,
  params: ScalpParams
): boolean {
  const hour =
    getHourFractionUtc(time);

  return (
    hour >= params.sessionStartHour &&
    hour <= params.sessionEndHour
  );
}

function calcBodyPct(
  candle: Candle
): number {
  if (candle.open <= 0) {
    return 0;
  }

  return (
    Math.abs(
      candle.close - candle.open
    ) / candle.open
  );
}

function calcCloseLocation(
  candle: Candle
): number {
  const range =
    candle.high - candle.low;

  if (range <= 0) {
    return 0.5;
  }

  return (
    candle.close - candle.low
  ) / range;
}

function calcVolumeRatio(
  volume: number,
  baselineVolume: number | null
): number {
  if (
    baselineVolume === null ||
    !Number.isFinite(baselineVolume) ||
    baselineVolume <= 0
  ) {
    return 0;
  }

  return volume / baselineVolume;
}

function calcDistancePct(
  a: number,
  b: number
): number {
  if (b === 0) {
    return 0;
  }

  return (
    Math.abs(a - b) /
    Math.abs(b)
  );
}

function highestHigh(
  candles: Candle[],
  from: number,
  to: number
): number {
  if (from > to) {
    return -Infinity;
  }

  let high = -Infinity;

  for (
    let index = Math.max(0, from);
    index <=
    Math.min(
      to,
      candles.length - 1
    );
    index++
  ) {
    high = Math.max(
      high,
      candles[index].high
    );
  }

  return high;
}

function lowestLow(
  candles: Candle[],
  from: number,
  to: number
): number {
  if (from > to) {
    return Infinity;
  }

  let low = Infinity;

  for (
    let index = Math.max(0, from);
    index <=
    Math.min(
      to,
      candles.length - 1
    );
    index++
  ) {
    low = Math.min(
      low,
      candles[index].low
    );
  }

  return low;
}

function detectPullbackLong(
  candles: Candle[],
  index: number,
  lookback: number
): number | null {
  const from = index - lookback;

  if (
    from < 1 ||
    index - 1 < from
  ) {
    return null;
  }

  const recentHigh =
    highestHigh(
      candles,
      from,
      index - 1
    );

  const previousClose =
    candles[index - 1].close;

  if (
    !Number.isFinite(recentHigh) ||
    recentHigh <= 0
  ) {
    return null;
  }

  const pullbackPct =
    (recentHigh - previousClose) /
    recentHigh;

  return Math.max(
    0,
    pullbackPct
  );
}

function detectPullbackShort(
  candles: Candle[],
  index: number,
  lookback: number
): number | null {
  const from = index - lookback;

  if (
    from < 1 ||
    index - 1 < from
  ) {
    return null;
  }

  const recentLow =
    lowestLow(
      candles,
      from,
      index - 1
    );

  const previousClose =
    candles[index - 1].close;

  if (
    !Number.isFinite(recentLow) ||
    recentLow <= 0
  ) {
    return null;
  }

  const pullbackPct =
    (previousClose - recentLow) /
    recentLow;

  return Math.max(
    0,
    pullbackPct
  );
}

function assertValidParams(
  params: ScalpParams
): void {
  const positiveValues = [
    params.atrPeriod1m,
    params.atrPeriod5m,
    params.emaFastPeriod5m,
    params.emaSlowPeriod5m,
    params.vwapPeriod1m,
    params.volumeLookback1m,
    params.trendAtrLookback5m,
    params.pullbackLookback1m,
    params.atrSlMult,
    params.atrTpMult
  ];

  if (
    positiveValues.some(
      value =>
        !Number.isFinite(value) ||
        value <= 0
    )
  ) {
    throw new Error(
      "Scalp parameters must contain positive periods and multipliers"
    );
  }

  if (
    params.riskPerTrade < 0 ||
    params.maxRiskPerTrade < 0 ||
    params.commissionRate < 0 ||
    params.slippageRate < 0 ||
    params.maxPositionNotionalPct <= 0
  ) {
    throw new Error(
      "Risk, cost and position parameters are invalid"
    );
  }

  if (
    params.trendAtrExpandRatio5m <= 0 ||
    params.atrExpansionTolerance5m <= 0 ||
    params.atrExpansionTolerance5m > 1
  ) {
    throw new Error(
      "ATR expansion parameters are invalid"
    );
  }

  if (
    params.minCloseLocationLong < 0 ||
    params.minCloseLocationLong > 1 ||
    params.maxCloseLocationShort < 0 ||
    params.maxCloseLocationShort > 1
  ) {
    throw new Error(
      "Close-location parameters must be between 0 and 1"
    );
  }

  if (
    params.sessionStartHour < 0 ||
    params.sessionStartHour > 24 ||
    params.sessionEndHour < 0 ||
    params.sessionEndHour > 24
  ) {
    throw new Error(
      "Session hours must be between 0 and 24"
    );
  }
}

export function floorToStep(
  value: number,
  step: number
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(step)
  ) {
    return 0;
  }

  if (step <= 0) {
    return value;
  }

  return Math.floor(
    value / step
  ) * step;
}

export function calculatePositionSize(
  input: PositionSizeInput
): number {
  const {
    equity,
    entryPrice,
    stopPrice,
    riskPerTrade,
    maxRiskPerTrade,
    maxPositionNotionalPct,
    commissionRate = 0,
    contractMultiplier = 1,
    minPositionSize = 0,
    positionSizeStep = 1
  } = input;

  if (
    !Number.isFinite(equity) ||
    equity <= 0 ||
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0 ||
    !Number.isFinite(stopPrice) ||
    stopPrice <= 0 ||
    contractMultiplier <= 0 ||
    commissionRate < 0
  ) {
    return 0;
  }

  const riskFraction =
    Math.min(
      Math.max(0, riskPerTrade),
      Math.max(0, maxRiskPerTrade)
    );

  const riskBudget =
    equity * riskFraction;

  const priceRiskPerUnit =
    Math.abs(
      entryPrice - stopPrice
    ) * contractMultiplier;

  const commissionRiskPerUnit =
    entryPrice *
    contractMultiplier *
    commissionRate;

  const totalRiskPerUnit =
    priceRiskPerUnit +
    commissionRiskPerUnit;

  if (
    riskBudget <= 0 ||
    totalRiskPerUnit <= 0
  ) {
    return 0;
  }

  const sizeByRisk =
    riskBudget /
    totalRiskPerUnit;

  const maxNotional =
    equity *
    Math.max(
      0,
      maxPositionNotionalPct
    );

  const sizeByNotional =
    maxNotional /
    (
      entryPrice *
      contractMultiplier
    );

  const rawSize =
    Math.min(
      sizeByRisk,
      sizeByNotional
    );

  if (
    rawSize < minPositionSize
  ) {
    return 0;
  }

  const roundedSize =
    floorToStep(
      rawSize,
      positionSizeStep
    );

  if (
    roundedSize < minPositionSize
  ) {
    return 0;
  }

  return roundedSize;
}

function getRoundTripCostPct(
  params: ScalpParams
): number {
  const commissionRoundTrip =
    params.commissionRate * 2;

  const slippageRoundTrip =
    params.slippageRate * 2;

  return (
    commissionRoundTrip +
    slippageRoundTrip
  );
}

function hasEnoughTargetAfterCosts(
  targetMovePct: number,
  params: ScalpParams
): boolean {
  const roundTripCostPct =
    getRoundTripCostPct(params);

  const minimumByCost =
    roundTripCostPct *
    params.minCostCoverage;

  return (
    targetMovePct >=
      params.minTargetMovePct &&
    targetMovePct >=
      minimumByCost
  );
}

function createEntryChecks(): EntryChecks {
  return {
    atrNotLow: null,
    atrNotSharplyContracting: null,
    atrAboveTrend: null,
    atrTrendThresholdPassed: null,
    atrPassed: null,
    volumePassed: null,
    impulseBodyPassed: null,
    vwapDistancePassed: null,
    trendPassed: null,
    directionalImpulsePassed: null,
    pullbackPassed: null,
    breakoutPassed: null,
    targetPassed: null
  };
}

function getFailedChecks(
  checks: EntryChecks
): string[] {
  return Object.entries(checks)
    .filter(([, value]) => value === false)
    .map(([name]) => name);
}

function createLongSignal(
  candles1m: Candle[],
  indicators1m: BarIndicators1m[],
  indicators5m: BarIndicators5m[],
  signalIndex: number,
  entryIndex: number,
  idx5m: number,
  params: ScalpParams,
  pullbackPct: number,
  volumeRatio: number,
  bodyPct: number,
  closeLocation: number,
  breakoutLevel: number
): ScalpSignal | null {
  const entryCandle =
    candles1m[entryIndex];

  const ind1m =
    indicators1m[signalIndex];

  const ctx5m =
    indicators5m[idx5m];

  if (
    !isFinitePositive(ind1m.atr1m) ||
    !isFinitePositive(ind1m.vwap1m) ||
    !isFinitePositive(ctx5m.atr5m)
  ) {
    return null;
  }

  const rawEntryPrice =
    Math.max(
      entryCandle.open,
      breakoutLevel
    );

  if (
    rawEntryPrice > entryCandle.high
  ) {
    return null;
  }

  const entryPrice =
    rawEntryPrice *
    (1 + params.slippageRate);

  const stopDistance =
    ind1m.atr1m *
    params.atrSlMult;

  const stopLossPrice =
    entryPrice - stopDistance;

  const takeProfitPrice =
    entryPrice +
    ind1m.atr1m *
    params.atrTpMult;

  const signalCandle =
    candles1m[signalIndex];

  return {
    side: "long",

    signalIndex,
    entryIndex,

    signalTime:
      signalCandle.time,

    entryTime:
      entryCandle.time,

    rawEntryPrice,
    triggerPrice:
      breakoutLevel,

    entryPrice,

    stopLossPrice,
    takeProfitPrice,

    riskDistance:
      stopDistance,

    atr1m:
      ind1m.atr1m,

    atr5m:
      ctx5m.atr5m,

    vwap1m:
      ind1m.vwap1m,

    impulseBodyPct:
      bodyPct,

    closeLocation,

    pullbackPct,

    volumeRatio,

    entryCommissionPct:
      params.commissionRate,

    estimatedExitCommissionPct:
      params.commissionRate,

    estimatedRoundTripSlippagePct:
      params.slippageRate * 2,

    estimatedRoundTripCostPct:
      getRoundTripCostPct(params),

    expectedNetTargetMovePct:
      (takeProfitPrice - entryPrice) / entryPrice -
      getRoundTripCostPct(params)
  };
}

function createShortSignal(
  candles1m: Candle[],
  indicators1m: BarIndicators1m[],
  indicators5m: BarIndicators5m[],
  signalIndex: number,
  entryIndex: number,
  idx5m: number,
  params: ScalpParams,
  pullbackPct: number,
  volumeRatio: number,
  bodyPct: number,
  closeLocation: number,
  breakoutLevel: number
): ScalpSignal | null {
  const entryCandle =
    candles1m[entryIndex];

  const ind1m =
    indicators1m[signalIndex];

  const ctx5m =
    indicators5m[idx5m];

  if (
    !isFinitePositive(ind1m.atr1m) ||
    !isFinitePositive(ind1m.vwap1m) ||
    !isFinitePositive(ctx5m.atr5m)
  ) {
    return null;
  }

  const rawEntryPrice =
    Math.min(
      entryCandle.open,
      breakoutLevel
    );

  if (
    rawEntryPrice < entryCandle.low
  ) {
    return null;
  }

  const entryPrice =
    rawEntryPrice *
    (1 - params.slippageRate);

  const stopDistance =
    ind1m.atr1m *
    params.atrSlMult;

  const stopLossPrice =
    entryPrice + stopDistance;

  const takeProfitPrice =
    entryPrice -
    ind1m.atr1m *
    params.atrTpMult;

  const signalCandle =
    candles1m[signalIndex];

  return {
    side: "short",

    signalIndex,
    entryIndex,

    signalTime:
      signalCandle.time,

    entryTime:
      entryCandle.time,

    rawEntryPrice,
    triggerPrice:
      breakoutLevel,

    entryPrice,

    stopLossPrice,
    takeProfitPrice,

    riskDistance:
      stopDistance,

    atr1m:
      ind1m.atr1m,

    atr5m:
      ctx5m.atr5m,

    vwap1m:
      ind1m.vwap1m,

    impulseBodyPct:
      bodyPct,

    closeLocation,

    pullbackPct,

    volumeRatio,

    entryCommissionPct:
      params.commissionRate,

    estimatedExitCommissionPct:
      params.commissionRate,

    estimatedRoundTripSlippagePct:
      params.slippageRate * 2,

    estimatedRoundTripCostPct:
      getRoundTripCostPct(params),

    expectedNetTargetMovePct:
      (entryPrice - takeProfitPrice) / entryPrice -
      getRoundTripCostPct(params)
  };
}

export function evaluateMomentumScalpEntry(
  candles1m: Candle[],
  indicators1m: BarIndicators1m[],
  candles5m: Candle[],
  indicators5m: BarIndicators5m[],
  signalIndex: number,
  params: ScalpParams =
    DEFAULT_SCALP_PARAMS
): EntryDecision {
  assertValidParams(params);

  if (
    !validateCandles(candles1m) ||
    !validateCandles(candles5m)
  ) {
    return {
      accepted: false,
      reason: "invalid_data",
      checks: createEntryChecks(),
      failedChecks: ["invalid_data"]
    };
  }

  if (
    signalIndex < 2 ||
    signalIndex + 1 >= candles1m.length ||
    signalIndex >= indicators1m.length
  ) {
    return {
      accepted: false,
      reason: "not_enough_history",
      checks: createEntryChecks(),
      failedChecks: ["not_enough_history"]
    };
  }

  const signalCandle =
    candles1m[signalIndex];

  const entryCandle =
    candles1m[signalIndex + 1];

  const ind1m =
    indicators1m[signalIndex];

  if (
    !inSession(
      signalCandle.time,
      params
    ) ||
    !inSession(
      entryCandle.time,
      params
    )
  ) {
    return {
      accepted: false,
      reason: "outside_session",
      checks: createEntryChecks(),
      failedChecks: ["outside_session"]
    };
  }

  if (
    !isFinitePositive(ind1m.atr1m) ||
    !isFinitePositive(ind1m.vwap1m) ||
    !isFinitePositive(
      ind1m.volumeSma1m
    )
  ) {
    return {
      accepted: false,
      reason: "missing_context",
      checks: createEntryChecks(),
      failedChecks: ["missing_context"]
    };
  }

  const idx5m =
    map1mIndexToClosed5mIndex(
      signalCandle.time,
      candles5m
    );

  if (
    idx5m < 1 ||
    idx5m >= indicators5m.length
  ) {
    return {
      accepted: false,
      reason: "missing_context",
      checks: createEntryChecks(),
      failedChecks: ["missing_context"]
    };
  }

  const ctx5m =
    indicators5m[idx5m];

  const previousCtx5m =
    indicators5m[idx5m - 1];

  if (
    !isFinitePositive(ctx5m.atr5m) ||
    !isFinitePositive(ctx5m.atr5mSma) ||
    !isFinitePositive(
      ctx5m.emaFast5m
    ) ||
    !isFinitePositive(
      ctx5m.emaSlow5m
    ) ||
    !isFinitePositive(
      ctx5m.close5m
    )
  ) {
    return {
      accepted: false,
      reason: "missing_context",
      checks: createEntryChecks(),
      failedChecks: ["missing_context"]
    };
  }

  const checks = createEntryChecks();

  const previousAtr =
    previousCtx5m?.atr5m;

  const trendAtrIndex =
    idx5m -
    params.trendAtrLookback5m;

  const trendAtr =
    trendAtrIndex >= 0
      ? indicators5m[
          trendAtrIndex
        ]?.atr5m
      : null;

  const hasPreviousAtr =
    isFinitePositive(previousAtr);

  const hasTrendAtr =
    isFinitePositive(trendAtr);

  const atrVsSma =
    ctx5m.atr5m /
    ctx5m.atr5mSma;

  const atrVsPrevious =
    hasPreviousAtr
      ? ctx5m.atr5m /
        Number(previousAtr)
      : null;

  const atrVsTrend =
    hasTrendAtr
      ? ctx5m.atr5m /
        Number(trendAtr)
      : null;

  const atrNotLow =
    atrVsSma >= 0.98;

  const atrNotSharplyContracting =
    atrVsPrevious === null ||
    atrVsPrevious >=
      params.atrExpansionTolerance5m;

  const atrAboveTrend =
    atrVsTrend !== null &&
    atrVsTrend >= 1;

  const atrTrendThresholdPassed =
    atrVsTrend !== null &&
    atrVsTrend >=
      params.trendAtrExpandRatio5m;

  const atrExpanding =
    atrNotLow &&
    atrNotSharplyContracting &&
    atrTrendThresholdPassed;

  checks.atrNotLow = atrNotLow;
  checks.atrNotSharplyContracting = atrNotSharplyContracting;
  checks.atrAboveTrend = atrAboveTrend;
  checks.atrTrendThresholdPassed = atrTrendThresholdPassed;
  checks.atrPassed = atrExpanding;

  if (!atrExpanding) {
    return {
      accepted: false,
      reason: "atr_not_expanding",
      checks,
      failedChecks: getFailedChecks(checks),
      diagnostics: {
        currentAtr: ctx5m.atr5m,
        atrSma: ctx5m.atr5mSma,
        previousAtr:
          hasPreviousAtr
            ? Number(previousAtr)
            : null,
        trendAtr:
          hasTrendAtr
            ? Number(trendAtr)
            : null,

        atrVsSma,
        atrVsPrevious,
        atrVsTrend,

        atrNotLow,
        atrNotSharplyContracting,
        atrAboveTrend,
        atrTrendThresholdPassed,

        trendAtrLookback5m:
          params.trendAtrLookback5m,
        trendAtrExpandRatio5m:
          params.trendAtrExpandRatio5m,
        atrExpansionTolerance5m:
          params.atrExpansionTolerance5m
      }
    };
  }

  const previousInd1m =
    indicators1m[signalIndex - 1];

  const volumeRatio =
    calcVolumeRatio(
      signalCandle.volume,
      previousInd1m?.volumeSma1m ?? null
    );

  checks.volumePassed =
    Number.isFinite(volumeRatio) &&
    volumeRatio >=
      params.volumeMinRatio1m;

  if (
    !Number.isFinite(volumeRatio) ||
    volumeRatio <
      params.volumeMinRatio1m
  ) {
    return {
      accepted: false,
      reason: "volume_too_small",
      checks,
      failedChecks: getFailedChecks(checks),
      diagnostics: {
        volume: signalCandle.volume,
        baselineVolume:
          previousInd1m?.volumeSma1m ?? null,
        volumeRatio,
        volumeMinRatio1m:
          params.volumeMinRatio1m
      }
    };
  }

  const bodyPct =
    calcBodyPct(signalCandle);

  checks.impulseBodyPassed =
    Number.isFinite(bodyPct) &&
    bodyPct >=
      params.minImpulseBodyPct;

  if (
    !Number.isFinite(bodyPct) ||
    bodyPct <
      params.minImpulseBodyPct
  ) {
    return {
      accepted: false,
      reason: "impulse_too_small",
      checks,
      failedChecks: getFailedChecks(checks),
      diagnostics: {
        bodyPct,
        minImpulseBodyPct:
          params.minImpulseBodyPct
      }
    };
  }

  const closeLocation =
    calcCloseLocation(
      signalCandle
    );

  const vwapDistancePct =
    calcDistancePct(
      signalCandle.close,
      ind1m.vwap1m
    );

  checks.vwapDistancePassed =
    vwapDistancePct <=
    params.maxEntryDistanceFromVwapPct;

  if (
    vwapDistancePct >
    params.maxEntryDistanceFromVwapPct
  ) {
    return {
      accepted: false,
      reason: "too_far_from_vwap",
      checks,
      failedChecks: getFailedChecks(checks),
      diagnostics: {
        vwapDistancePct,
        vwap: ind1m.vwap1m,
        maxEntryDistanceFromVwapPct:
          params.maxEntryDistanceFromVwapPct
      }
    };
  }

  const is5mLongTrend =
    ctx5m.emaFast5m >
      ctx5m.emaSlow5m &&
    ctx5m.close5m >
      ctx5m.emaFast5m;

  const is5mShortTrend =
    ctx5m.emaFast5m <
      ctx5m.emaSlow5m &&
    ctx5m.close5m <
      ctx5m.emaFast5m;

  checks.trendPassed =
    is5mLongTrend !== is5mShortTrend;

  if (
    is5mLongTrend ===
    is5mShortTrend
  ) {
    return {
      accepted: false,
      reason: "trend_not_aligned",
      checks,
      failedChecks: getFailedChecks(checks),
      diagnostics: {
        is5mLongTrend,
        is5mShortTrend,
        emaFast5m: ctx5m.emaFast5m,
        emaSlow5m: ctx5m.emaSlow5m,
        close5m: ctx5m.close5m
      }
    };
  }

  const recentHigh =
    highestHigh(
      candles1m,
      signalIndex -
        params.pullbackLookback1m,
      signalIndex - 1
    );

  const recentLow =
    lowestLow(
      candles1m,
      signalIndex -
        params.pullbackLookback1m,
      signalIndex - 1
    );

  if (
    !Number.isFinite(recentHigh) ||
    !Number.isFinite(recentLow) ||
    recentHigh <= 0 ||
    recentLow <= 0
  ) {
    return {
      accepted: false,
      reason: "missing_context",
      checks,
      failedChecks: getFailedChecks(checks),
      diagnostics: {
        recentHigh,
        recentLow
      }
    };
  }

  const longPullbackPct =
    detectPullbackLong(
      candles1m,
      signalIndex,
      params.pullbackLookback1m
    );

  const shortPullbackPct =
    detectPullbackShort(
      candles1m,
      signalIndex,
      params.pullbackLookback1m
    );

  const longBreakoutLevel =
    recentHigh *
    (1 + params.breakoutBufferPct);

  const shortBreakoutLevel =
    recentLow *
    (1 - params.breakoutBufferPct);

  if (is5mLongTrend) {
    const bullishImpulse =
      signalCandle.close >
      signalCandle.open;

    checks.directionalImpulsePassed =
      bullishImpulse &&
      closeLocation >=
        params.minCloseLocationLong;

    if (
      !bullishImpulse ||
      closeLocation <
        params.minCloseLocationLong
    ) {
      return {
        accepted: false,
        reason: "impulse_too_small",
        checks,
        failedChecks: getFailedChecks(checks),
        diagnostics: {
          bullishImpulse,
          closeLocation,
          minCloseLocationLong:
            params.minCloseLocationLong
        }
      };
    }

    checks.pullbackPassed =
      longPullbackPct !== null &&
      longPullbackPct >=
        params.minPullbackPct;

    if (
      longPullbackPct === null ||
      longPullbackPct <
        params.minPullbackPct
    ) {
      return {
        accepted: false,
        reason: "pullback_too_small",
        checks,
        failedChecks: getFailedChecks(checks),
        diagnostics: {
          longPullbackPct,
          minPullbackPct:
            params.minPullbackPct
        }
      };
    }

    checks.breakoutPassed =
      entryCandle.high >=
      longBreakoutLevel;

    if (
      entryCandle.high <
      longBreakoutLevel
    ) {
      return {
        accepted: false,
        reason: "breakout_missing",
        checks,
        failedChecks: getFailedChecks(checks),
        diagnostics: {
          entryHigh: entryCandle.high,
          longBreakoutLevel
        }
      };
    }

    const longSignal =
      createLongSignal(
        candles1m,
        indicators1m,
        indicators5m,
        signalIndex,
        signalIndex + 1,
        idx5m,
        params,
        longPullbackPct,
        volumeRatio,
        bodyPct,
        closeLocation,
        longBreakoutLevel
      );

    if (!longSignal) {
      return {
        accepted: false,
        reason:
          "target_too_small_for_costs",
        checks,
        failedChecks: getFailedChecks(checks),
        diagnostics: {
          rawEntryPrice: Math.max(
            entryCandle.open,
            longBreakoutLevel
          ),
          entryPrice: Math.max(
            entryCandle.open,
            longBreakoutLevel
          ) * (1 + params.slippageRate),
          takeProfitPrice:
            Math.max(
              entryCandle.open,
              longBreakoutLevel
            ) * (1 + params.slippageRate) +
            ind1m.atr1m * params.atrTpMult,
          targetMovePct:
            ind1m.atr1m * params.atrTpMult /
            (Math.max(
              entryCandle.open,
              longBreakoutLevel
            ) * (1 + params.slippageRate)),
          minTargetMovePct:
            params.minTargetMovePct,
          minCostCoverage:
            params.minCostCoverage,
          roundTripCostPct:
            getRoundTripCostPct(params)
        }
      };
    }

    const longTargetMovePct =
      (longSignal.takeProfitPrice -
        longSignal.entryPrice) /
      longSignal.entryPrice;

    checks.targetPassed =
      hasEnoughTargetAfterCosts(
        longTargetMovePct,
        params
      );

    return {
      accepted: true,
      signal: longSignal,
      checks,
      failedChecks: []
    };
  }

  if (is5mShortTrend) {
    const bearishImpulse =
      signalCandle.close <
      signalCandle.open;

    checks.directionalImpulsePassed =
      bearishImpulse &&
      closeLocation <=
        params.maxCloseLocationShort;

    if (
      !bearishImpulse ||
      closeLocation >
        params.maxCloseLocationShort
    ) {
      return {
        accepted: false,
        reason: "impulse_too_small",
        checks,
        failedChecks: getFailedChecks(checks),
        diagnostics: {
          bearishImpulse,
          closeLocation,
          maxCloseLocationShort:
            params.maxCloseLocationShort
        }
      };
    }

    checks.pullbackPassed =
      shortPullbackPct !== null &&
      shortPullbackPct >=
        params.minPullbackPct;

    if (
      shortPullbackPct === null ||
      shortPullbackPct <
        params.minPullbackPct
    ) {
      return {
        accepted: false,
        reason: "pullback_too_small",
        checks,
        failedChecks: getFailedChecks(checks),
        diagnostics: {
          shortPullbackPct,
          minPullbackPct:
            params.minPullbackPct
        }
      };
    }

    checks.breakoutPassed =
      entryCandle.low <=
      shortBreakoutLevel;

    if (
      entryCandle.low >
      shortBreakoutLevel
    ) {
      return {
        accepted: false,
        reason: "breakout_missing",
        checks,
        failedChecks: getFailedChecks(checks),
        diagnostics: {
          entryLow: entryCandle.low,
          shortBreakoutLevel
        }
      };
    }

    const shortSignal =
      createShortSignal(
        candles1m,
        indicators1m,
        indicators5m,
        signalIndex,
        signalIndex + 1,
        idx5m,
        params,
        shortPullbackPct,
        volumeRatio,
        bodyPct,
        closeLocation,
        shortBreakoutLevel
      );

    if (!shortSignal) {
      return {
        accepted: false,
        reason:
          "target_too_small_for_costs",
        checks,
        failedChecks: getFailedChecks(checks),
        diagnostics: {
          rawEntryPrice: Math.min(
            entryCandle.open,
            shortBreakoutLevel
          ),
          entryPrice: Math.min(
            entryCandle.open,
            shortBreakoutLevel
          ) * (1 - params.slippageRate),
          takeProfitPrice:
            Math.min(
              entryCandle.open,
              shortBreakoutLevel
            ) * (1 - params.slippageRate) -
            ind1m.atr1m * params.atrTpMult,
          targetMovePct:
            ind1m.atr1m * params.atrTpMult /
            (Math.min(
              entryCandle.open,
              shortBreakoutLevel
            ) * (1 - params.slippageRate)),
          minTargetMovePct:
            params.minTargetMovePct,
          minCostCoverage:
            params.minCostCoverage,
          roundTripCostPct:
            getRoundTripCostPct(params)
        }
      };
    }

    const shortTargetMovePct =
      (shortSignal.entryPrice -
        shortSignal.takeProfitPrice) /
      shortSignal.entryPrice;

    checks.targetPassed =
      hasEnoughTargetAfterCosts(
        shortTargetMovePct,
        params
      );

    return {
      accepted: true,
      signal: shortSignal,
      checks,
      failedChecks: []
    };
  }

  return {
    accepted: false,
    reason: "no_signal",
    checks,
    failedChecks: getFailedChecks(checks)
  };
}

export class ScalpStrategy {
  private readonly params: ScalpParams;

  constructor(
    params?: Partial<ScalpParams>
  ) {
    this.params = {
      ...DEFAULT_SCALP_PARAMS,
      commissionRate:
        config.commissionRate,
      slippageRate:
        config.slippageRate,
      ...params
    };

    assertValidParams(
      this.params
    );
  }

  getParams(): ScalpParams {
    return {
      ...this.params
    };
  }

  build1mIndicators(
    candles: Candle[]
  ): BarIndicators1m[] {
    return build1mIndicators(
      candles,
      this.params
    );
  }

  build5mIndicators(
    candles: Candle[]
  ): BarIndicators5m[] {
    return build5mIndicators(
      candles,
      this.params
    );
  }

  evaluateEntry(
    candles1m: Candle[],
    indicators1m: BarIndicators1m[],
    candles5m: Candle[],
    indicators5m: BarIndicators5m[],
    signalIndex: number
  ): EntryDecision {
    return evaluateMomentumScalpEntry(
      candles1m,
      indicators1m,
      candles5m,
      indicators5m,
      signalIndex,
      this.params
    );
  }

  calculatePositionSize(
    entryPrice: number,
    stopPrice: number,
    equity = config.virtualBalance
  ): number {
    return calculatePositionSize({
      equity,
      entryPrice,
      stopPrice,

      riskPerTrade:
        this.params.riskPerTrade,

      maxRiskPerTrade:
        this.params.maxRiskPerTrade,

      maxPositionNotionalPct:
        this.params.maxPositionNotionalPct,

      commissionRate:
        this.params.commissionRate,

      contractMultiplier:
        this.params.contractMultiplier ??
        1,

      minPositionSize:
        this.params.minPositionSize ??
        0,

      positionSizeStep:
        this.params.positionSizeStep ??
        1
    });
  }

  async getCurrentPrice(
    symbol: string
  ): Promise<number> {
    return tbankClient.getCurrentPrice(
      symbol
    );
  }

  determineRegime(
    candles: Candle[]
  ): RegimeResult {
    if (
      !validateCandles(candles) ||
      candles.length < 30
    ) {
      return {
        regime:
          candles.length === 0
            ? "no_data"
            : "not_ready",
        ready: false
      };
    }

    const candles5m =
      aggregateCandlesTo5m(
        candles,
        true
      );

    if (candles5m.length < 3) {
      return {
        regime: "not_ready",
        ready: false
      };
    }

    const indicators5m =
      this.build5mIndicators(
        candles5m
      );

    const current =
      indicators5m[
        indicators5m.length - 1
      ];

    if (
      !isFinitePositive(
        current.emaFast5m
      ) ||
      !isFinitePositive(
        current.emaSlow5m
      ) ||
      !isFinitePositive(
        current.close5m
      )
    ) {
      return {
        regime: "not_ready",
        ready: false
      };
    }

    if (
      current.emaFast5m >
        current.emaSlow5m &&
      current.close5m >
        current.emaFast5m
    ) {
      return {
        regime: "bullish",
        ready: true
      };
    }

    if (
      current.emaFast5m <
        current.emaSlow5m &&
      current.close5m <
        current.emaFast5m
    ) {
      return {
        regime: "bearish",
        ready: true
      };
    }

    return {
      regime: "flat",
      ready: true
    };
  }

  calculateSignal(
    candles: Candle[],
    _symbol?: string
  ): LegacySignalResult {
    if (
      !validateCandles(candles) ||
      candles.length < 3
    ) {
      return {
        ready: false,
        buy: false,
        sell: false,
        side: "none",
        regime: "not_ready",
        signal: null,
        reason: "not_enough_history",
        indicators: {
          ready: false
        }
      };
    }

    const candles1m =
      candles;

    const candles5m =
      aggregateCandlesTo5m(
        candles1m,
        true
      );

    const indicators1m =
      this.build1mIndicators(
        candles1m
      );

    const indicators5m =
      this.build5mIndicators(
        candles5m
      );

    const signalIndex =
      candles1m.length - 2;

    const decision =
      this.evaluateEntry(
        candles1m,
        indicators1m,
        candles5m,
        indicators5m,
        signalIndex
      );

    const signal =
      decision.signal;

    const regime =
      this.determineRegime(
        candles1m
      );

    const last1m =
      indicators1m[
        indicators1m.length - 1
      ];

    const last5m =
      indicators5m[
        indicators5m.length - 1
      ];

    const positionSize =
      signal
        ? this.calculatePositionSize(
            signal.entryPrice,
            signal.stopLossPrice
          )
        : undefined;

    return {
      ready: true,

      buy:
        signal?.side === "long",

      sell:
        signal?.side === "short",

      side:
        signal?.side || "none",

      regime:
        regime.regime,

      positionSize,

      takeProfitPrice:
        signal?.takeProfitPrice,

      stopLossPrice:
        signal?.stopLossPrice,

      signal:
        signal || null,

      reason:
        decision.reason,

      indicators: {
        atr1m:
          last1m?.atr1m ?? null,

        atr5m:
          last5m?.atr5m ?? null,

        vwap1m:
          last1m?.vwap1m ?? null,

        emaFast5m:
          last5m?.emaFast5m ?? null,

        emaSlow5m:
          last5m?.emaSlow5m ?? null,

        lastAtr:
          last1m?.atr1m ?? null,

        ready:
          Boolean(
            last1m?.atr1m &&
            last5m?.atr5m
          )
      }
    };
  }
}

export default ScalpStrategy;
