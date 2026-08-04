# Trade Bot Sculp TBank

## Назначение

**API-сервис для n8n** (paper trading):
- Расчёт торговых сигналов (скальпинг стратегия)
- Виртуальное открытие/закрытие позиций с учётом комиссии
- Определение рыночного режима (normal / high_volatility / no_data)

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
  "quantity": 100,
  "entryPrice": 285.5
}
```

**Response:**
```json
{
  "balance": 999985.75,
  "balanceBefore": 1000000,
  "commissionOpen": 14.25,
  "position": {
    "symbol": "TCSG",
    "side": "long",
    "entryPrice": 285.5,
    "quantity": 100,
    "notional": 28550,
    "takeProfitPrice": 287.0,
    "stopLossPrice": 284.0,
    "openedAt": "2025-01-15T10:30:00.000Z",
    "commissionOpen": 14.25
  }
}
```

### POST /position/check-close

**Request:**
```json
{ "symbol": "TCSG", "currentPrice": 289.0 }
```

**Response (закрытие по TP):**
```json
{
  "action": "closed",
  "result": {
    "balance": 1000335.5,
    "lastClosedTrade": {
      "symbol": "TCSG",
      "side": "long",
      "exitPrice": 289.0,
      "closedAt": "2025-01-15T11:00:00.000Z",
      "reason": "tp",
      "realizedPnL": 335.5,
      "commissionOpen": 14.25,
      "commissionClose": 14.45
    }
  }
}
```

**Response (позиция не закрыта):**
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

- **Paper Trading** (по умолчанию): Виртуальные сделки с учётом комиссии (0.05% на круг), реальные ордера НЕ отправляются
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
1. n8n вызывает `/market/regime` → проверка `ready` и `regime !== 'high_volatility'`
2. n8n вызывает `/bot/run` для получения сигнала
3. Если сигнал есть → n8n вызывает `/position/open` для виртуального открытия (с комиссией)
4. n8n делает INSERT в PostgreSQL (signals, positions)
5. n8n отправляет Telegram уведомление
6. По расписанию n8n вызывает `/position/check-close` с `currentPrice` для проверки TP/SL и получения `realizedPnL`

## Development

```bash
npm install
npm run dev
```

## License

MIT
