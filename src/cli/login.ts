import fs from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadEnvConfig } from "../config/env.js";
import { authDir, storageStatePath } from "../config/paths.js";
import { PlaywrightCli } from "../browser/playwrightCli.js";
import { logger } from "../utils/logger.js";

export async function runLogin(): Promise<void> {
  const config = loadEnvConfig();
  const playwrightCli = new PlaywrightCli(config);

  await playwrightCli.open();
  logger.info(
    "Log in manually, open the target book if needed, then press Enter here."
  );

  const rl = createInterface({ input, output });
  await rl.question("Press Enter after login is complete...");
  rl.close();

  await fs.mkdir(authDir, { recursive: true });
  await playwrightCli.stateSave(storageStatePath);
  logger.info({ path: storageStatePath }, "Saved storage state.");
}
