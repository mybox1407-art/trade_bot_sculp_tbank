import config from "../config";
import {
  Candle,
  EntryDecision,
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

  private readonly lastProcessedCandle =
    new Map<string, number>();

  private readonly lastSignalCandle =
    new Map<string, number>();

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
          config.maxPositionNotionalPct
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
          await this.processSymbol(
            symbol
          );
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

    /*
     * Require a small buffer of candles so that
     * indicator warm-up and ATR alignment have enough data.
     * The strategy itself will still reject signals
     * with not_enough_history if needed.
     */
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

    /*
     * Signal is built on the last closed 1m candle.
     * The last candle in the array may still be forming.
     */
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

    const decision =
      this.calculateDecision(
        candles1m,
        candles5m,
        signalIndex
      );

    /*
     * Mark the candle as processed only after
     * the decision calculation has completed.
     */
    this.lastProcessedCandle.set(
      symbol,
      signalCandle.time
    );

    if (
      !decision.accepted ||
      !decision.signal
    ) {
      csvLogService.logEvent(
        "signal_rejected",
        symbol,
        decision.reason ||
          "no_signal",
        decision
      );

      return;
    }

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
            this.params.cooldownBars
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
          maxEntryDeviation
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
              .getCurrentPositionLimit()
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

    /*
     * Cooldown is tracked by the entry time,
     * i.e. the moment when the trade is actually executed.
     */
    this.lastSignalCandle.set(
      symbol,
      signal.entryTime
    );

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
            .getCurrentPositionLimit()
      }
    );
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

    /*
     * All timestamps inside ScalpSignal are in milliseconds
     * and come from candle.time, so no normalization is needed.
     */
    const signalTime =
      signal.entryTime;

    const lastSignalTime =
      lastSignal;

    const elapsedMs =
      signalTime - lastSignalTime;

    if (elapsedMs < 0) {
      logger.warn(
        `Signal time moved backwards for ${symbol}: ` +
          `last=${lastSignalTime}, ` +
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

    /*
     * Variable is specified in percent:
     * 0.15 means 0.15%.
     */
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
