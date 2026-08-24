import config from "../config";
import {
  Candle,
  EntryDecision,
  EntryRejectReason,
  ScalpParams,
  ScalpSignal
} from "../types";
import candleService from "./CandleService";
import positionService from "./PositionService";
import csvLogService from "./CsvLogService";
import telegramService from "./TelegramService";
import { ScalpStrategy } from "./ScalpStrategy";
import logger from "../utils/logger";

export interface BotRunnerStatus {
  running: boolean;
  startedAt: number | null;
  lastCycleAt: number | null;
  lastError: string | null;
  symbols: string[];
  openPositions: number;
  cashBalance: number;
  realizedPnl: number;
}

interface RejectLogState {
  reason: string;
  signalCandleTime: number;
  closed5mCandleTime: number | null;
}

interface FilterSummary {
  total: number;
  accepted: number;
  rejected: Record<string, number>;
}

interface SymbolDecisionContext {
  signalCandleTime: number;
  closed5mCandleTime: number | null;
}

export class BotRunner {
  private readonly strategy: ScalpStrategy;
  private readonly symbols: string[];
  private readonly params: ScalpParams;

  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private cycleInProgress = false;

  private startedAt: number | null = null;
  private lastCycleAt: number | null = null;
  private lastError: string | null = null;

  /*
   * Protects against evaluating the same closed 1m candle twice.
   */
  private readonly lastProcessedCandle =
    new Map<string, number>();

  /*
   * Tracks actual accepted entry times for cooldown handling.
   */
  private readonly lastSignalCandle =
    new Map<string, number>();

  /*
   * Tracks the last rejection that was emitted to CSV.
   * Rejections are logged only when a new 1m candle appears,
   * a new closed 5m context appears, or rejection reason changes.
   */
  private readonly lastRejectLog =
    new Map<string, RejectLogState>();

  /*
   * Tracks closed 5m context used for every symbol.
   * This makes repeated ATR diagnostics explicit.
   */
  private readonly lastClosed5mContext =
    new Map<string, number | null>();

  /*
   * Aggregated scanner diagnostics.
   */
  private summaryStartedAt = Date.now();

  private summary: FilterSummary = {
    total: 0,
    accepted: 0,
    rejected: {}
  };

  private readonly summaryIntervalMs =
    5 * 60 * 1000;

  constructor(
    strategy: ScalpStrategy,
    symbols: string[],
    params: ScalpParams
  ) {
    this.strategy = strategy;
    this.symbols = symbols;
    this.params = params;
  }

  start(): void {
    if (this.running) {
      logger.warn(
        "BotRunner is already running"
      );

      return;
    }

    if (this.symbols.length === 0) {
      throw new Error(
        "No instruments configured. " +
          "Set INSTRUMENTS or SYMBOLS in .env"
      );
    }

    this.running = true;
    this.startedAt = Date.now();
    this.lastError = null;
    this.summaryStartedAt = Date.now();
    this.summary = {
      total: 0,
      accepted: 0,
      rejected: {}
    };

    logger.info(
      `BotRunner started for instruments: ` +
        `${this.symbols.join(", ")}`
    );

    csvLogService.logEvent(
      "bot_started",
      "",
      "Autonomous bot started",
      {
        instruments: this.symbols,
        mode: config.tradingMode,
        initialBalance:
          config.virtualBalance,
        maxOpenPositions:
          config.maxOpenPositions,
        maxPositionNotionalPct:
          config.maxPositionNotionalPct,
        pollIntervalMs:
          config.pollIntervalMs
      }
    );

    void telegramService
      .notifyBotStarted(this.symbols)
      .catch((error) => {
        logger.error(
          "Failed to send bot started notification:",
          error
        );
      });

    this.timer = setInterval(() => {
      void this.runCycle().catch((error) => {
        this.handleCycleError(
          "Scheduled bot cycle failed",
          error
        );
      });
    }, config.pollIntervalMs);

    void this.runCycle().catch((error) => {
      this.handleCycleError(
        "Initial bot cycle failed",
        error
      );
    });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.flushScannerSummary(true);

    csvLogService.logEvent(
      "bot_stopped",
      "",
      "Autonomous bot stopped"
    );

    try {
      await telegramService.notifyBotStopped();
    } catch (error) {
      logger.error(
        "Failed to send bot stopped notification:",
        error
      );
    }

    logger.info(
      "BotRunner stopped"
    );
  }

  isRunning(): boolean {
    return this.running;
  }

  getStatus(): BotRunnerStatus {
    const account =
      positionService.getAccount();

    return {
      running: this.running,
      startedAt: this.startedAt,
      lastCycleAt: this.lastCycleAt,
      lastError: this.lastError,
      symbols: [...this.symbols],
      openPositions:
        positionService
          .getOpenPositions()
          .length,
      cashBalance:
        account.cashBalance,
      realizedPnl:
        account.realizedPnl
    };
  }

  private async runCycle(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.cycleInProgress) {
      logger.warn(
        "Skipping cycle: previous cycle is still running"
      );

      return;
    }

    this.cycleInProgress = true;
    this.lastCycleAt = Date.now();

    try {
      for (const symbol of this.symbols) {
        if (!this.running) {
          break;
        }

        try {
          await this.processSymbol(symbol);
        } catch (error) {
          this.lastError =
            this.errorToMessage(error);

          logger.error(
            `Failed to process ${symbol}:`,
            error
          );

          csvLogService.logEvent(
            "symbol_processing_error",
            symbol,
            this.lastError
          );

          try {
            await telegramService.notifyError(
              `Обработка ${symbol}`,
              error
            );
          } catch (notificationError) {
            logger.error(
              `Failed to send error notification for ${symbol}:`,
              notificationError
            );
          }
        }
      }

      this.flushScannerSummary();
    } finally {
      this.cycleInProgress = false;
    }
  }

  private async processSymbol(
    symbol: string
  ): Promise<void> {
    const currentPrice =
      await this.getCurrentPrice(symbol);

    this.validatePrice(
      currentPrice,
      `current price for ${symbol}`
    );

    const existingPosition =
      positionService.getPosition(symbol);

    if (
      existingPosition &&
      existingPosition.status === "open"
    ) {
      positionService.checkAndClosePosition(
        symbol,
        currentPrice
      );

      return;
    }

    const openPositions =
      positionService.getOpenPositions();

    if (
      openPositions.length >=
      config.maxOpenPositions
    ) {
      csvLogService.logEvent(
        "position_limit",
        symbol,
        "Maximum open positions reached",
        {
          currentOpenPositions:
            openPositions.length,
          maxOpenPositions:
            config.maxOpenPositions
        }
      );

      return;
    }

    const {
      candles1m,
      candles5m
    } =
      await candleService
        .getCandlesForSignal(
          symbol,
          config.candles1mMinutes,
          config.candles5mMinutes
        );

    if (
      candles1m.length < 5 ||
      candles5m.length < 5
    ) {
      csvLogService.logEvent(
        "not_enough_data",
        symbol,
        "Not enough candles for indicators",
        {
          candles1m: candles1m.length,
          candles5m: candles5m.length
        }
      );

      return;
    }

    const signalIndex =
      candles1m.length - 2;

    const signalCandle =
      candles1m[signalIndex];

    if (!signalCandle) {
      csvLogService.logEvent(
        "missing_signal_candle",
        symbol,
        "Closed signal candle is unavailable"
      );

      return;
    }

    if (
      this.isCandleAlreadyProcessed(
        symbol,
        signalCandle.time
      )
    ) {
      return;
    }

    const closed5mCandleTime =
      this.getClosed5mCandleTime(
        signalCandle.time,
        candles5m
      );

    const decisionContext: SymbolDecisionContext = {
      signalCandleTime:
        signalCandle.time,
      closed5mCandleTime
    };

    const previousClosed5mContext =
      this.lastClosed5mContext.get(symbol);

    const closed5mChanged =
      previousClosed5mContext !==
      closed5mCandleTime;

    this.lastClosed5mContext.set(
      symbol,
      closed5mCandleTime
    );

    const decision =
      this.calculateDecision(
        candles1m,
        candles5m,
        signalIndex
      );

    this.lastProcessedCandle.set(
      symbol,
      signalCandle.time
    );

    this.summary.total += 1;

    if (
      !decision.accepted ||
      !decision.signal
    ) {
      this.recordRejectedDecision(
        symbol,
        decision,
        decisionContext,
        closed5mChanged
      );

      return;
    }

    this.summary.accepted += 1;

    if (
      this.isCooldownActive(
        symbol,
        decision.signal
      )
    ) {
      csvLogService.logEvent(
        "signal_cooldown",
        symbol,
        "Signal rejected by cooldown",
        {
          signal: decision.signal,
          cooldownBars:
            this.params.cooldownBars,
          signalCandleTime:
            signalCandle.time,
          closed5mCandleTime
        }
      );

      return;
    }

    const signal =
      decision.signal;

    this.validateSignal(
      signal,
      symbol
    );

    const entryDeviation =
      Math.abs(
        currentPrice -
          signal.entryPrice
      ) /
      signal.entryPrice;

    const maxEntryDeviation =
      this.getMaxEntryDeviation();

    if (
      entryDeviation >
      maxEntryDeviation
    ) {
      csvLogService.logEvent(
        "entry_price_stale",
        symbol,
        "Entry price differs too much from current price",
        {
          currentPrice,
          entryPrice:
            signal.entryPrice,
          entryDeviation,
          maxEntryDeviation,
          signalCandleTime:
            signalCandle.time,
          closed5mCandleTime
        }
      );

      return;
    }

    const availableBalance =
      positionService
        .getAvailableBalance();

    this.validatePrice(
      availableBalance,
      `available balance for ${symbol}`,
      true
    );

    const calculatedQuantity =
      this.strategy.calculatePositionSize(
        signal.entryPrice,
        signal.stopLossPrice,
        availableBalance
      );

    const maxQuantity =
      positionService.calculateMaxQuantity(
        signal.entryPrice
      );

    const positionStep =
      this.params.positionSizeStep &&
      this.params.positionSizeStep > 0
        ? this.params.positionSizeStep
        : 1;

    const quantity =
      this.floorToStep(
        Math.min(
          calculatedQuantity,
          maxQuantity
        ),
        positionStep
      );

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      csvLogService.logEvent(
        "position_size_zero",
        symbol,
        "Position size is zero after risk and balance limits",
        {
          calculatedQuantity,
          maxQuantity,
          quantity,
          availableBalance,
          currentPositionLimit:
            positionService
              .getCurrentPositionLimit(),
          signalCandleTime:
            signalCandle.time,
          closed5mCandleTime
        }
      );

      return;
    }

    const position =
      positionService.openPosition({
        symbol,
        side: signal.side,
        quantity,
        entryPrice:
          signal.entryPrice,
        stopLossPrice:
          signal.stopLossPrice,
        takeProfitPrice:
          signal.takeProfitPrice,
        signal
      });

    this.lastSignalCandle.set(
      symbol,
      signal.entryTime
    );

    this.lastRejectLog.delete(symbol);

    csvLogService.logEvent(
      "signal_accepted",
      symbol,
      "Signal accepted and position opened",
      {
        decision,
        quantity,
        position,
        availableBalance,
        currentPrice,
        entryDeviation,
        currentPositionLimit:
          positionService
            .getCurrentPositionLimit(),
        signalCandleTime:
          signalCandle.time,
        closed5mCandleTime
      }
    );
  }

  private recordRejectedDecision(
    symbol: string,
    decision: EntryDecision,
    context: SymbolDecisionContext,
    closed5mChanged: boolean
  ): void {
    const reason =
      decision.reason || "no_signal";

    this.summary.rejected[reason] =
      (this.summary.rejected[reason] || 0) + 1;

    if (
      !this.shouldLogRejectedDecision(
        symbol,
        reason,
        context,
        closed5mChanged
      )
    ) {
      return;
    }

    csvLogService.logEvent(
      "signal_rejected",
      symbol,
      reason,
      {
        ...decision,
        signalCandleTime:
          context.signalCandleTime,
        closed5mCandleTime:
          context.closed5mCandleTime,
        note:
          "Rejection logged after state change only"
      }
    );
  }

  private shouldLogRejectedDecision(
    symbol: string,
    reason: string,
    context: SymbolDecisionContext,
    closed5mChanged: boolean
  ): boolean {
    const previous =
      this.lastRejectLog.get(symbol);

    const reasonChanged =
      previous === undefined ||
      previous.reason !== reason;

    const signalCandleChanged =
      previous === undefined ||
      previous.signalCandleTime !==
        context.signalCandleTime;

    const closed5mCandleChanged =
      previous === undefined ||
      previous.closed5mCandleTime !==
        context.closed5mCandleTime;

    /*
     * Always log a changed rejection reason.
     * For ATR-related rejection, log only when the closed 5m
     * context changes; this avoids repeated messages when the
     * same 5m ATR values are reused across 1m scanner cycles.
     */
    const isAtrReject =
      reason === "atr_not_expanding";

    const shouldLog =
      reasonChanged ||
      (
        !isAtrReject &&
        signalCandleChanged
      ) ||
      (
        isAtrReject &&
        (
          closed5mCandleChanged ||
          closed5mChanged
        )
      );

    if (!shouldLog) {
      return false;
    }

    this.lastRejectLog.set(symbol, {
      reason,
      signalCandleTime:
        context.signalCandleTime,
      closed5mCandleTime:
        context.closed5mCandleTime
    });

    return true;
  }

  private getClosed5mCandleTime(
    signalCandleTime: number,
    candles5m: Candle[]
  ): number | null {
    const currentBucketStart =
      Math.floor(
        signalCandleTime /
          (5 * 60 * 1000)
      ) *
      (5 * 60 * 1000);

    const lastClosedBucketStart =
      currentBucketStart -
      5 * 60 * 1000;

    let result: number | null = null;

    for (const candle of candles5m) {
      if (
        candle.time <=
        lastClosedBucketStart
      ) {
        result = candle.time;
      } else {
        break;
      }
    }

    return result;
  }

  private flushScannerSummary(
    force = false
  ): void {
    const now = Date.now();

    if (
      !force &&
      now - this.summaryStartedAt <
        this.summaryIntervalMs
    ) {
      return;
    }

    if (this.summary.total === 0) {
      this.summaryStartedAt = now;

      return;
    }

    csvLogService.logEvent(
      "scanner_summary",
      "",
      "Aggregated signal scanner statistics",
      {
        startedAt:
          this.summaryStartedAt,
        finishedAt: now,
        periodMs:
          now - this.summaryStartedAt,
        totalEvaluations:
          this.summary.total,
        accepted:
          this.summary.accepted,
        rejected:
          this.summary.rejected
      }
    );

    this.summaryStartedAt = now;
    this.summary = {
      total: 0,
      accepted: 0,
      rejected: {}
    };
  }

  private calculateDecision(
    candles1m: Candle[],
    candles5m: Candle[],
    signalIndex: number
  ): EntryDecision {
    const indicators1m =
      this.strategy.build1mIndicators(
        candles1m
      );

    const indicators5m =
      this.strategy.build5mIndicators(
        candles5m
      );

    return this.strategy.evaluateEntry(
      candles1m,
      indicators1m,
      candles5m,
      indicators5m,
      signalIndex
    );
  }

  private isCandleAlreadyProcessed(
    symbol: string,
    candleTime: number
  ): boolean {
    const lastTime =
      this.lastProcessedCandle.get(
        symbol
      );

    return (
      lastTime !== undefined &&
      lastTime >= candleTime
    );
  }

  private isCooldownActive(
    symbol: string,
    signal: ScalpSignal
  ): boolean {
    const lastSignal =
      this.lastSignalCandle.get(
        symbol
      );

    if (
      lastSignal === undefined
    ) {
      return false;
    }

    const signalTime =
      signal.entryTime;

    const elapsedMs =
      signalTime - lastSignal;

    if (elapsedMs < 0) {
      logger.warn(
        `Signal time moved backwards for ${symbol}: ` +
          `last=${lastSignal}, ` +
          `current=${signalTime}`
      );

      return true;
    }

    const timeframeMs =
      60 * 1000;

    return (
      elapsedMs <
      this.params.cooldownBars *
        timeframeMs
    );
  }

  private async getCurrentPrice(
    symbol: string
  ): Promise<number> {
    return this.strategy.getCurrentPrice(
      symbol
    );
  }

  private validatePrice(
    value: number,
    label: string,
    allowZero = false
  ): void {
    const isValid =
      Number.isFinite(value) &&
      (
        allowZero
          ? value >= 0
          : value > 0
      );

    if (!isValid) {
      throw new Error(
        `Invalid ${label}: ${value}`
      );
    }
  }

  private validateSignal(
    signal: ScalpSignal,
    symbol: string
  ): void {
    this.validatePrice(
      signal.entryPrice,
      `entry price for ${symbol}`
    );

    this.validatePrice(
      signal.stopLossPrice,
      `stop-loss price for ${symbol}`
    );

    this.validatePrice(
      signal.takeProfitPrice,
      `take-profit price for ${symbol}`
    );

    this.validatePrice(
      signal.riskDistance,
      `risk distance for ${symbol}`
    );

    if (
      signal.side === "long" &&
      (
        signal.stopLossPrice >=
          signal.entryPrice ||
        signal.takeProfitPrice <=
          signal.entryPrice
      )
    ) {
      throw new Error(
        `Invalid long signal levels for ${symbol}: ` +
          `entry=${signal.entryPrice}, ` +
          `stop=${signal.stopLossPrice}, ` +
          `takeProfit=${signal.takeProfitPrice}`
      );
    }

    if (
      signal.side === "short" &&
      (
        signal.stopLossPrice <=
          signal.entryPrice ||
        signal.takeProfitPrice >=
          signal.entryPrice
      )
    ) {
      throw new Error(
        `Invalid short signal levels for ${symbol}: ` +
          `entry=${signal.entryPrice}, ` +
          `stop=${signal.stopLossPrice}, ` +
          `takeProfit=${signal.takeProfitPrice}`
      );
    }
  }

  private getMaxEntryDeviation(): number {
    const value =
      Number(
        process.env.MAX_ENTRY_DEVIATION_PCT ||
          "0.15"
      );

    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      return 0.0015;
    }

    return value / 100;
  }

  private floorToStep(
    value: number,
    step: number
  ): number {
    if (
      !Number.isFinite(value) ||
      !Number.isFinite(step) ||
      step <= 0
    ) {
      return 0;
    }

    return Math.floor(
      value / step
    ) * step;
  }

  private errorToMessage(
    error: unknown
  ): string {
    return error instanceof Error
      ? error.message
      : String(error);
  }

  private handleCycleError(
    message: string,
    error: unknown
  ): void {
    this.lastError =
      this.errorToMessage(error);

    logger.error(
      message,
      error
    );

    csvLogService.logEvent(
      "cycle_error",
      "",
      this.lastError
    );

    void telegramService
      .notifyError(message, error)
      .catch((notificationError) => {
        logger.error(
          "Failed to send cycle error notification:",
          notificationError
        );
      });
  }
}

export default BotRunner;
