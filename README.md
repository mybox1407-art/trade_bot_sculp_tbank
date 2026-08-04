# Trade Bot Sculp TBank

## Назначение

**API-сервис для n8n** (paper trading):
- Расчёт торговых сигналов (скальпинг стратегия)
- Виртуальное открытие/закрытие позиций
- Определение рыночного режима

## Architecture

```
n8n (workflow) → Trade Bot (API) → T-Invest API (candles)
n8n → PostgreSQL (signals, positions, trades)
n8n → Telegram (notifications)
```

## Endpoints

### POST /bot/run

**Request:**
```json
{ "symbol": "TCSG" }
```

**Response:**
```json
{
  "symbol": "TCSG",
  "timeframe": "1m",
  "ready": true,
  "price": 285.5,
  "buy": true,
  "sell": false,
  "side": "long",
  "regime": "normal",
  "positionSize": 0.02,
  "takeProfitPrice": 287.0,
  "stopLossPrice": 284.0,
  "indicators": {
    "lastRsi": 55.2,
    "lastAtr": 1.5,
    "ready": true
  }
}
```

### POST /market/regime

**Request:**
```json
{ "symbol": "TCSG" }
```

**Response:**
```json
{ "symbol": "TCSG", "regime": "normal", "ready": true }
```

### POST /position/open

**Request:**
```json
{
  "symbol": "TCSG",
  "takeProfitPrice": 287.0,
  "stopLossPrice": 284.0,
  "side": "long",
  "positionSize": 0.02,
  "quantity": 100
}
```

**Response:**
```json
{
  "balance": 1000000,
  "position": {
    "symbol": "TCSG",
    "side": "long",
    "entryPrice": 287.0,
    "quantity": 100,
    "notional": 28700,
    "takeProfitPrice": 287.0,
    "stopLossPrice": 284.0,
    "openedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### POST /position/check-close

**Request:**
```json
{ "symbol": "TCSG" }
```

**Response:**
```json
{
  "action": "none",
  "result": {
    "balance": 1000000,
    "lastClosedTrade": null
  }
}
```

## Mode

- **Paper Trading** (по умолчанию): Виртуальные сделки, реальные ордера НЕ отправляются
- **Live Trading**: В разработке (требует интеграции с T-Invest API)

## Environment Variables

```bash
# .env.example
PORT=3011
TINKOFF_API_KEY=your_api_key
TINKOFF_ACCOUNT_ID=your_account_id
```

## n8n Integration

Этот бот спроектирован для работы с n8n workflow:
1. n8n вызывает `/bot/run` для получения сигнала
2. Если сигнал есть → n8n вызывает `/position/open` для виртуального открытия
3. n8n делает INSERT в PostgreSQL (signals, positions)
4. n8n отправляет Telegram уведомление
5. По расписанию n8n вызывает `/position/check-close` для проверки закрытия

## Development

```bash
npm install
npm run dev
```

## License

MIT
