import axios, {
  AxiosInstance
} from "axios";
import config from "../config";
import logger from "./logger";
import { Candle } from "../types";

function quotationToNumber(
  value: unknown
): number {
  if (
    typeof value === "number"
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    return Number(value);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const item = value as {
      units?: number | string;
      nano?: number;
    };

    const units = Number(
      item.units || 0
    );

    const nano = Number(
      item.nano || 0
    );

    return units + nano / 1e9;
  }

  return 0;
}

export class TBankClient {
  private readonly api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: config.tbankApiUrl,
      timeout: 15000,
      headers: {
        Authorization:
          `Bearer ${config.tbankApiKey}`,
        "Content-Type":
          "application/json"
      }
    });
  }

  async getCandles(
    figi: string,
    from: Date,
    to: Date,
    interval: "1m" | "5m" = "1m"
  ): Promise<Candle[]> {
    try {
      const response =
        await this.api.post(
          "/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetCandles",
          {
            figi,
            from: from.toISOString(),
            to: to.toISOString(),
            interval:
              interval === "1m"
                ? "CANDLE_INTERVAL_1_MIN"
                : "CANDLE_INTERVAL_5_MIN"
          }
        );

      const rawCandles =
        response.data?.candles ||
        response.data?.items ||
        [];

      return rawCandles
        .map((candle: any) => ({
          time: new Date(
            candle.time
          ).getTime(),

          open: quotationToNumber(
            candle.open
          ),

          high: quotationToNumber(
            candle.high
          ),

          low: quotationToNumber(
            candle.low
          ),

          close: quotationToNumber(
            candle.close
          ),

          volume: Number(
            candle.volume || 0
          )
        }))
        .filter(
          (candle: Candle) =>
            Number.isFinite(candle.time) &&
            candle.open > 0 &&
            candle.high > 0 &&
            candle.low > 0 &&
            candle.close > 0
        )
        .sort(
          (a: Candle, b: Candle) =>
            a.time - b.time
        );
    } catch (error: any) {
      logger.error(
        `Error fetching candles for ${figi}:`,
        error.response?.data ||
        error.message
      );

      throw error;
    }
  }

  async getCurrentPrice(
    figi: string
  ): Promise<number> {
    try {
      const response =
        await this.api.post(
          "/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetLastPrices",
          {
            figi: [figi]
          }
        );

      const prices =
        response.data?.lastPrices ||
        response.data?.last_prices ||
        [];

      return quotationToNumber(
        prices[0]?.price ||
        prices[0]?.lastPrice ||
        prices[0]?.last_price
      );
    } catch (error: any) {
      logger.error(
        `Error fetching price for ${figi}:`,
        error.response?.data ||
        error.message
      );

      throw error;
    }
  }

  async openPosition(
    figi: string,
    side: "Buy" | "Sell",
    quantity: number,
    orderType: "Limit" | "Market" = "Market"
  ): Promise<string> {
    if (
      config.tradingMode !== "live"
    ) {
      throw new Error(
        "Live order rejected: TRADING_MODE is not live"
      );
    }

    try {
      const response =
        await this.api.post(
          "/rest/tinkoff.public.invest.api.contract.v1.OrdersService/PostOrder",
          {
            figi,
            quantity: String(quantity),
            direction:
              side === "Buy"
                ? "ORDER_DIRECTION_BUY"
                : "ORDER_DIRECTION_SELL",
            orderType:
              orderType === "Market"
                ? "ORDER_TYPE_MARKET"
                : "ORDER_TYPE_LIMIT",
            accountId:
              config.tbankAccountId
          }
        );

      return String(
        response.data?.orderId ||
        response.data?.order_id ||
        ""
      );
    } catch (error: any) {
      logger.error(
        `Error opening position for ${figi}:`,
        error.response?.data ||
        error.message
      );

      throw error;
    }
  }

  async closePosition(
    figi: string,
    side: "Buy" | "Sell",
    quantity: number
  ): Promise<string> {
    const oppositeSide =
      side === "Buy"
        ? "Sell"
        : "Buy";

    return this.openPosition(
      figi,
      oppositeSide,
      quantity,
      "Market"
    );
  }

  async getPositions(): Promise<
    Array<{
      figi: string;
      quantity: number;
      averagePositionPrice: number;
      currentPrice: number;
      dailyYield: number;
    }>
  > {
    if (
      config.tradingMode !== "live"
    ) {
      return [];
    }

    try {
      const response =
        await this.api.post(
          "/rest/tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio",
          {
            accountId:
              config.tbankAccountId
          }
        );

      const positions =
        response.data?.positions || [];

      return positions.map(
        (position: any) => ({
          figi: position.figi,
          quantity: Number(
            position.quantity || 0
          ),
          averagePositionPrice:
            quotationToNumber(
              position.averagePositionPrice
            ),
          currentPrice:
            quotationToNumber(
              position.currentPrice
            ),
          dailyYield:
            quotationToNumber(
              position.dailyYield
            )
        })
      );
    } catch (error: any) {
      logger.error(
        "Error fetching positions:",
        error.response?.data ||
        error.message
      );

      throw error;
    }
  }
}

export const tbankClient =
  new TBankClient();

export default tbankClient;
