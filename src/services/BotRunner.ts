import config from "../config";
import {
  BarIndicators1m,
  BarIndicators5m,
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
import { logger } from "../utils";

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
        "No symbols configured"
      );
    }

    this.running = true;
    this.startedAt = Date.now();
    this.lastError = null;

    logger.info(
      `BotRunner started for symbols: ` +
      `${this.symbols.join(", ")}`
    );

    csvLogService.logEvent(
      "bot_started",
      "",
      "Autonomous bot started",
      {
        symbols: this.symbols,
        mode: config.tradingMode
      }
    );

    void telegramService.sendMessage(
      `🤖 <b>Бот запущен</b>\n\n` +
      `<b>Режим:</b> ${config.tradingMode}\n` +
      `<b>Инструменты:</b> ` +
      `${this.symbols.join(", ")}`
    );

    this.timer = setInterval(
      () => {
        void this.runCycle();
      },
      config.pollIntervalMs
    );

    void this.runCycle();
  }

  async stop(): Promise<void> {
    if (!this.running) return;

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

    await telegramService.sendMessage(
      "🛑 <b>Бот остановлен</b>"
    );

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
      cashBalance: account.cashBalance,
      realizedPnl: account.realizedPnl
    };
  }

  private async runCycle(): Promise<void> {
    if (!this.running) return;

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
        if (!this.running) break;

        try {
          await this.processSymbol(
            symbol
          );
        } catch (error) {
          this.lastError =
            error instanceof Error
              ? error.message
              : String(error);

          logger.error(
            `Failed to process ${symbol}:`,
            error
          );

          csvLogService.logEvent(
            "symbol_processing_error",
            symbol,
            this.lastError
          );

          await telegramService.notifyError(
            `processing ${symbol}`,
            error
          );
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
      await this.getCurrentPrice(
        symbol
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

    if (
      positionService.getOpenPositions()
        .length >= config.maxOpenPositions
    ) {
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
      candles1m.length < 3 ||
      candles5m.length < 3
    ) {
      csvLogService.logEvent(
        "not_enough_data",
        symbol,
        "Not enough candles"
      );

      return;
    }

    const latestCandle =
      candles1m[candles1m.length - 1];

    if (
      this.isCandleAlreadyProcessed(
        symbol,
        latestCandle.time
      )
    ) {
      return;
    }

    this.lastProcessedCandle.set(
      symbol,
      latestCandle.time
    );

    const decision =
      this.calculateDecision(
        candles1m,
        candles5m
      );

    if (
      !decision.accepted ||
      !decision.signal
    ) {
      csvLogService.logEvent(
        "signal_rejected",
        symbol,
        decision.reason || "no_signal",
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
        decision.signal
      );

      return;
    }

    const quantity =
      this.strategy.calculatePositionSize(
        decision.signal.entryPrice,
        decision.signal.stopLossPrice
      );

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      csvLogService.logEvent(
        "position_size_zero",
        symbol,
        "Calculated quantity is zero"
      );

      return;
    }

    const position =
      positionService.openPosition({
        symbol,
        side: decision.signal.side,
        quantity,
        entryPrice: decision.signal.entryPrice,
        stopLossPrice:
          decision.signal.stopLossPrice,
        takeProfitPrice:
          decision.signal.takeProfitPrice,
        signal: decision.signal
      });

    this.lastSignalCandle.set(
      symbol,
      decision.signal.signalTime
    );

    csvLogService.logEvent(
      "signal_accepted",
      symbol,
      "Signal accepted and position opened",
      {
        decision,
        quantity,
        position
      }
    );
  }

  private calculateDecision(
    candles1m: Candle[],
    candles5m: Candle[]
  ): EntryDecision {
    const indicators1m =
      this.strategy.build1mIndicators(
        candles1m
      );

    const indicators5m =
      this.strategy.build5mIndicators(
        candles5m
      );

    const signalIndex =
      candles1m.length - 2;

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

    return lastTime === candleTime;
  }

  private isCooldownActive(
    symbol: string,
    signal: ScalpSignal
  ): boolean {
    const lastSignal =
      this.lastSignalCandle.get(symbol);

    if (!lastSignal) return false;

    const timeframeMs = 60 * 1000;

    return (
      signal.signalTime - lastSignal <
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
}
