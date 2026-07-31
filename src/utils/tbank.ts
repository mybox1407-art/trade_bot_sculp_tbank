import axios from "axios";
import config from "../config";
import logger from "./logger";
import { Candle } from "../types";

export class TBankClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.tbankApiKey;
    this.baseUrl = config.tbankApiUrl;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async getCandles(
    figi: string,
    from: Date,
    to: Date,
    interval: "1m" | "5m" = "1m"
  ): Promise<Candle[]> {
    try {
      const url = `${this.baseUrl}/candles`;
      const params = { figi, from: from.toISOString(), to: to.toISOString(), interval };
      const response = await axios.get(url, { headers: this.getHeaders(), params });
      return response.data.candles.map((c: any) => ({
        time: new Date(c.time).getTime(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
    } catch (error: any) {
      logger.error(`Error fetching candles for ${figi}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getCurrentPrice(figi: string): Promise<number> {
    try {
      const url = `${this.baseUrl}/last_prices`;
      const response = await axios.get(url, { headers: this.getHeaders(), params: { figi } });
      return parseFloat(response.data.last_prices[0]?.last_price || "0");
    } catch (error: any) {
      logger.error(`Error fetching price for ${figi}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async openPosition(
    figi: string,
    side: "Buy" | "Sell",
    quantity: number,
    orderType: "Limit" | "Market" = "Market"
  ): Promise<string> {
    try {
      const url = `${this.baseUrl}/orders`;
      const response = await axios.post(
        url,
        { figi, operation: side, quantity, type: orderType },
        { headers: this.getHeaders() }
      );
      return response.data.order_id;
    } catch (error: any) {
      logger.error(`Error opening position for ${figi}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async closePosition(figi: string, side: "Buy" | "Sell", quantity: number): Promise<string> {
    const oppositeSide = side === "Buy" ? "Sell" : "Buy";
    return await this.openPosition(figi, oppositeSide, quantity, "Market");
  }

  async getPositions(): Promise<Array<{ figi: string; quantity: number; averagePositionPrice: number; currentPrice: number; dailyYield: number }>> {
    try {
      const url = `${this.baseUrl}/portfolio`;
      const response = await axios.get(url, { headers: this.getHeaders() });
      return response.data.positions.map((p: any) => ({
        figi: p.figi,
        quantity: p.quantity,
        averagePositionPrice: parseFloat(p.averagePositionPrice),
        currentPrice: parseFloat(p.currentPrice),
        dailyYield: parseFloat(p.dailyYield),
      }));
    } catch (error: any) {
      logger.error("Error fetching positions:", error.response?.data || error.message);
      throw error;
    }
  }
}

export const tbankClient = new TBankClient();
export default tbankClient;
