import dotenv from "dotenv";

dotenv.config();

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return [
    "1",
    "true",
    "yes",
    "on"
  ].includes(value.toLowerCase());
}

function parseNumber(
  value: string | undefined,
  defaultValue: number
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : defaultValue;
}

function parseInstruments(
  value: string | undefined
): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

const instrumentsValue =
  process.env.INSTRUMENTS ||
  process.env.SYMBOLS ||
  "";

export const config = {
  nodeEnv:
    process.env.NODE_ENV ||
    "development",

  port: parseNumber(
    process.env.PORT,
    3011
  ),

  tradingMode:
    process.env.TRADING_MODE === "live"
      ? "live"
      : "paper",

  tbankApiKey:
    process.env.TBANK_API_KEY ||
    process.env.TINKOFF_API_KEY ||
    "",

  tbankApiUrl:
    process.env.TBANK_API_URL ||
    "https://invest-public-api.tbank.ru",

  tbankAccountId:
    process.env.TBANK_ACCOUNT_ID ||
    process.env.TINKOFF_ACCOUNT_ID ||
    "",

  virtualBalance: parseNumber(
    process.env.VIRTUAL_BALANCE,
    50000
  ),

  commissionRate: parseNumber(
    process.env.COMMISSION_RATE,
    0.0005
  ),

  slippageRate: parseNumber(
    process.env.SLIPPAGE_RATE,
    0.00015
  ),

  timeframe:
    process.env.TIMEFRAME ||
    "1m",

  instruments:
    parseInstruments(instrumentsValue),

  // Совместимость с текущим BotRunner,
  // который использует config.symbols.
  symbols:
    parseInstruments(instrumentsValue),

  botEnabled: parseBoolean(
    process.env.BOT_ENABLED,
    true
  ),

  pollIntervalMs: parseNumber(
    process.env.POLL_INTERVAL_MS,
    15000
  ),

  candles1mMinutes: parseNumber(
    process.env.CANDLES_1M_MINUTES,
    500
  ),

  candles5mMinutes: parseNumber(
    process.env.CANDLES_5M_MINUTES,
    1000
  ),

  positionTimeStopMinutes:
    parseNumber(
      process.env.POSITION_TIME_STOP_MINUTES,
      16
    ),

  /*
   * Фиксированные ограничения стратегии:
   * стартовый баланс задаётся VIRTUAL_BALANCE,
   * максимум 3 открытые позиции,
   * одна позиция — максимум 30%
   * текущего динамического баланса.
   */
  maxOpenPositions: 3,
  maxPositionNotionalPct: 0.30,

  minPositionSize: parseNumber(
    process.env.MIN_POSITION_SIZE,
    1
  ),

  positionSizeStep: parseNumber(
    process.env.POSITION_SIZE_STEP,
    1
  ),

  contractMultiplier: parseNumber(
    process.env.CONTRACT_MULTIPLIER,
    1
  ),

  csvDir:
    process.env.CSV_DIR ||
    "data",

  stateFile:
    process.env.STATE_FILE ||
    "data/bot-state.json",

  telegramBotToken:
    process.env.TELEGRAM_BOT_TOKEN ||
    "",

  telegramChatId:
    process.env.TELEGRAM_CHAT_ID ||
    "",

  telegramEnabled: parseBoolean(
    process.env.TELEGRAM_ENABLED,
    true
  ),

  healthEnabled: parseBoolean(
    process.env.HEALTH_ENABLED,
    true
  )
};

export default config;
