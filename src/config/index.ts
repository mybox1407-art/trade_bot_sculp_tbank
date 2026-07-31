import dotenv from "dotenv";

dotenv.config();

export const config = {
  tbankApiKey: process.env.TBANK_API_KEY || "",
  tbankApiUrl: process.env.TBANK_API_URL || "https://invest-public-api.tinkoff.ru",
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
};

export default config;
