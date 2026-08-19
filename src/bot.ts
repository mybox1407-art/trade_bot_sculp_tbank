import config from "./config";
import { ScalpStrategy } from "./services/ScalpStrategy";
import { BotRunner } from "./services/BotRunner";

const strategy =
  new ScalpStrategy();

const botRunner =
  new BotRunner(
    strategy,
    config.symbols,
    strategy.getParams()
  );

export default botRunner;
