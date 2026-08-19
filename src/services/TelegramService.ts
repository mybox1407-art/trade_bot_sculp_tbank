import axios from "axios";
import config from "../config";
import logger from "../utils/logger";

export class TelegramService {
  private readonly enabled: boolean;
  private readonly botToken: string;
  private readonly chatId: string;

  constructor() {
    this.enabled =
      config.telegramEnabled &&
      Boolean(config.telegramBotToken) &&
      Boolean(config.telegramChatId);

    this.botToken =
      config.telegramBotToken;

    this.chatId =
      config.telegramChatId;

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

  async notifyPositionOpened(
    position: {
      symbol: string;
      side: string;
      quantity: number;
      entryPrice: number;
      stopLossPrice: number;
      takeProfitPrice: number;
      commissionOpen: number;
      notional: number;
    }
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
      `Комиссия: ${position.commissionOpen.toFixed(2)} RUB`,
      `Режим: ${config.tradingMode}`
    ].join("\n");

    await this.sendMessage(message);
  }

  async notifyPositionClosed(
    position: {
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
      `Комиссия входа: ${position.commissionOpen.toFixed(2)} RUB`,
      `Комиссия выхода: ${position.commissionClose.toFixed(2)} RUB`,
      `Режим: ${config.tradingMode}`
    ].join("\n");

    await this.sendMessage(message);
  }

  async notifyError(
    context: string,
    error: unknown
  ): Promise<void> {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    await this.sendMessage(
      [
        "⚠️ Ошибка бота",
        "",
        `Контекст: ${context}`,
        `Сообщение: ${message}`
      ].join("\n")
    );
  }

  async notifyBotStarted(
    symbols: string[]
  ): Promise<void> {
    await this.sendMessage(
      [
        "🤖 Бот запущен",
        "",
        `Режим: ${config.tradingMode}`,
        `Инструменты: ${symbols.join(", ")}`,
        `Максимум позиций: ${config.maxOpenPositions}`,
        `Лимит на позицию: ${(
          config.maxPositionNotionalPct *
          100
        ).toFixed(0)}%`
      ].join("\n")
    );
  }

  async notifyBotStopped(): Promise<void> {
    await this.sendMessage(
      "🛑 Бот остановлен"
    );
  }
}

export const telegramService =
  new TelegramService();

export default telegramService;
