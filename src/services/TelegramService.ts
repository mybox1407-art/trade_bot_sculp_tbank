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
    if (!this.enabled) return;

    const url =
      `https://api.telegram.org/bot` +
      `${this.botToken}/sendMessage`;

    try {
      await axios.post(url, {
        chat_id: this.chatId,
        text,
        parse_mode: "HTML",
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
      `${icon} <b>Открыта позиция</b>`,
      ``,
      `<b>Инструмент:</b> ${position.symbol}`,
      `<b>Сторона:</b> ${position.side}`,
      `<b>Количество:</b> ${position.quantity}`,
      `<b>Вход:</b> ${position.entryPrice}`,
      `<b>Stop-loss:</b> ${position.stopLossPrice}`,
      `<b>Take-profit:</b> ${position.takeProfitPrice}`,
      `<b>Notional:</b> ${position.notional.toFixed(2)}`,
      `<b>Комиссия:</b> ${position.commissionOpen.toFixed(2)}`,
      `<b>Режим:</b> ${config.tradingMode}`
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
    const profitable = position.pnl >= 0;
    const icon = profitable ? "✅" : "❌";

    const message = [
      `${icon} <b>Позиция закрыта</b>`,
      ``,
      `<b>Инструмент:</b> ${position.symbol}`,
      `<b>Сторона:</b> ${position.side}`,
      `<b>Количество:</b> ${position.quantity}`,
      `<b>Вход:</b> ${position.entryPrice}`,
      `<b>Выход:</b> ${position.closePrice}`,
      `<b>Причина:</b> ${position.closeReason}`,
      `<b>Gross PnL:</b> ${position.grossPnl.toFixed(2)}`,
      `<b>Net PnL:</b> ${position.pnl.toFixed(2)}`,
      `<b>Комиссия входа:</b> ${position.commissionOpen.toFixed(2)}`,
      `<b>Комиссия выхода:</b> ${position.commissionClose.toFixed(2)}`,
      `<b>Режим:</b> ${config.tradingMode}`
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
      `⚠️ <b>Ошибка бота</b>\n\n` +
      `<b>Контекст:</b> ${context}\n` +
      `<b>Сообщение:</b> ${message}`
    );
  }
}

export const telegramService =
  new TelegramService();

export default telegramService;
