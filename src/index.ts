import express from "express";
import cors from "cors";
import config from "./config";
import apiRouter from "./api";
import botRunner from "./bot";
import logger from "./utils/logger";

const app = express();

app.use(cors());
app.use(express.json());

app.get(
  "/",
  (_req, res) => {
    res.json({
      service: "moex-scalp-live",
      mode: config.tradingMode,
      status: "ok",
      timestamp: Date.now()
    });
  }
);

app.use("/api", apiRouter);

const server =
  app.listen(
    config.port,
    () => {
      logger.info(
        `HTTP server started on port ` +
        `${config.port}`
      );

      logger.info(
        `Trading mode: ${config.tradingMode}`
      );

      if (
        config.botEnabled &&
        config.symbols.length > 0
      ) {
        botRunner.start();
      } else {
        logger.warn(
          "Bot is disabled or no symbols configured"
        );
      }
    }
  );

async function shutdown(
  signal: string
): Promise<void> {
  logger.info(
    `Received ${signal}, shutting down`
  );

  await botRunner.stop();

  server.close(() => {
    logger.info(
      "HTTP server stopped"
    );

    process.exit(0);
  });

  setTimeout(() => {
    logger.error(
      "Forced shutdown after timeout"
    );

    process.exit(1);
  }, 10000).unref();
}

process.on(
  "SIGTERM",
  () => void shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => void shutdown("SIGINT")
);

process.on(
  "unhandledRejection",
  reason => {
    logger.error(
      "Unhandled promise rejection:",
      reason
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    logger.error(
      "Uncaught exception:",
      error
    );
  }
);
