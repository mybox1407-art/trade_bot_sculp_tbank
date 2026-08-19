import fs from "fs";
import path from "path";
import config from "../config";
import logger from "../utils/logger";
import { Position } from "../types";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export class CsvLogService {
  private readonly directory: string;
  private readonly tradesFile: string;
  private readonly eventsFile: string;

  constructor() {
    this.directory = config.csvDir;
    this.tradesFile = path.join(
      this.directory,
      "trades.csv"
    );
    this.eventsFile = path.join(
      this.directory,
      "events.csv"
    );

    this.ensureDirectory();
    this.ensureHeaders();
  }

  private ensureDirectory(): void {
    fs.mkdirSync(this.directory, {
      recursive: true
    });
  }

  private ensureFile(
    file: string,
    headers: string[]
  ): void {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(
        file,
        `${headers.join(",")}\n`,
        "utf8"
      );
    }
  }

  private ensureHeaders(): void {
    this.ensureFile(this.tradesFile, [
      "event",
      "timestamp",
      "id",
      "symbol",
      "side",
      "status",
      "quantity",
      "entryPrice",
      "closePrice",
      "stopLossPrice",
      "takeProfitPrice",
      "notional",
      "grossPnl",
      "pnl",
      "commissionOpen",
      "commissionClose",
      "closeReason",
      "entryTime",
      "closeTime"
    ]);

    this.ensureFile(this.eventsFile, [
      "event",
      "timestamp",
      "symbol",
      "message",
      "payload"
    ]);
  }

  private append(
    file: string,
    values: unknown[]
  ): void {
    const line =
      values.map(csvEscape).join(",") + "\n";

    fs.appendFileSync(file, line, "utf8");
  }

  logEvent(
    event: string,
    symbol: string,
    message: string,
    payload?: unknown
  ): void {
    try {
      this.append(this.eventsFile, [
        event,
        new Date().toISOString(),
        symbol,
        message,
        payload
          ? JSON.stringify(payload)
          : ""
      ]);
    } catch (error) {
      logger.error(
        "Failed to write event CSV",
        error
      );
    }
  }

  logPositionOpened(
    position: Position
  ): void {
    this.append(this.tradesFile, [
      "open",
      new Date().toISOString(),
      position.id,
      position.symbol,
      position.side,
      position.status,
      position.quantity,
      position.entryPrice,
      "",
      position.stopLossPrice,
      position.takeProfitPrice,
      position.notional,
      "",
      "",
      position.commissionOpen,
      "",
      "",
      position.entryTime,
      ""
    ]);
  }

  logPositionClosed(
    position: Position
  ): void {
    this.append(this.tradesFile, [
      "close",
      new Date().toISOString(),
      position.id,
      position.symbol,
      position.side,
      position.status,
      position.quantity,
      position.entryPrice,
      position.closePrice,
      position.stopLossPrice,
      position.takeProfitPrice,
      position.notional,
      position.grossPnl,
      position.pnl,
      position.commissionOpen,
      position.commissionClose,
      position.closeReason,
      position.entryTime,
      position.closeTime
    ]);
  }
}

export const csvLogService =
  new CsvLogService();

export default csvLogService;
