import axios from "axios";
import config from "../config";
import logger from "../utils/logger";

export interface OpenedPositionNotification {
  symbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  commissionOpen: number;
  notional: number;
}

export interface ClosedPositionNotification {
  symbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  closePrice: number;
  pnl: number;
  grossPnl: number;
  commissionOpen: number;
  commissionClose: number;
  closeReason: string;
}

export class TelegramService {
  private readonly enabled: boolean;
  private readonly botToken: string;
  private readonly chatId: string;

  constructor() {
    this.botToken =
      config.telegramBotToken;

    this.chatId =
      config.telegramChatId;

    this.enabled =
      config.telegramEnabled &&
      Boolean(this.botToken) &&
      Boolean(this.chatId);

    if (!this.enabled) {
      logger.warn(
        "Telegram notifications are disabled or not configured"
      );
    }
  }

  async sendMessage(
    text: string
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const url =
      `https://api.telegram.org/bot` +
      `${this.botToken}/sendMessage`;

    try {
      await axios.post(url, {
        chat_id: this.chatId,
        text,
        disable_web_page_preview: true
      });
    } catch (error: any) {
      logger.error(
        "Failed to send Telegram message",
        error.response?.data ||
          error.message
      );
    }
  }

  async notifyBotStarted(
    symbols: string[]
  ): Promise<void> {
    const message = [
      "🤖 Бот запущен",
      "",
      `Режим: ${config.tradingMode}`,
      `Инструменты: ${symbols.join(", ")}`,
      `Начальный баланс: ${config.virtualBalance.toFixed(2)} RUB`,
      `Максимум открытых сделок: ${config.maxOpenPositions}`,
      `Лимит одной сделки: ${(config.maxPositionNotionalPct * 100).toFixed(0)}% динамического баланса`
    ].join("\n");

    await this.sendMessage(message);
  }

  async notifyBotStopped(): Promise<void> {
    await this.sendMessage(
      "🛑 Бот остановлен"
    );
  }

  async notifyPositionOpened(
    position: OpenedPositionNotification
  ): Promise<void> {
    const icon =
      position.side === "long"
        ? "🟢"
        : "🔴";

    const message = [
      `${icon} Открыта позиция`,
      "",
      `Инструмент: ${position.symbol}`,
      `Сторона: ${position.side}`,
      `Количество: ${position.quantity}`,
      `Цена входа: ${position.entryPrice}`,
      `Stop-loss: ${position.stopLossPrice}`,
      `Take-profit: ${position.takeProfitPrice}`,
      `Объём: ${position.notional.toFixed(2)} RUB`,
      `Комиссия открытия: ${position.commissionOpen.toFixed(2)} RUB`,
      `Режим: ${config.tradingMode}`
    ].join("\n");

    await this.sendMessage(message);
  }

  async notifyPositionClosed(
    position: ClosedPositionNotification
  ): Promise<void> {
    const icon =
      position.pnl >= 0
        ? "✅"
        : "❌";

    const message = [
      `${icon} Позиция закрыта`,
      "",
      `Инструмент: ${position.symbol}`,
      `Сторона: ${position.side}`,
      `Количество: ${position.quantity}`,
      `Цена входа: ${position.entryPrice}`,
      `Цена выхода: ${position.closePrice}`,
      `Причина: ${position.closeReason}`,
      `Gross PnL: ${position.grossPnl.toFixed(2)} RUB`,
      `Net PnL: ${position.pnl.toFixed(2)} RUB`,
      `Комиссия открытия: ${position.commissionOpen.toFixed(2)} RUB`,
      `Комиссия закрытия: ${position.commissionClose.toFixed(2)} RUB`,
      `Режим: ${config.tradingMode}`
    ].join("\n");

    await this.sendMessage(message);
  }

  async notifyError(
    context: string,
    error: unknown
  ): Promise<void> {
    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    const message = [
      "⚠️ Ошибка бота",
      "",
      `Контекст: ${context}`,
      `Сообщение: ${errorMessage}`
    ].join("\n");

    await this.sendMessage(message);
  }
}

export const telegramService =
  new TelegramService();

export default telegramService;
