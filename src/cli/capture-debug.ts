import fs from "node:fs";
import { loadEnvConfig } from "../config/env.js";
import { storageStatePath } from "../config/paths.js";
import { PlaywrightCli } from "../browser/playwrightCli.js";
import { CaptureRunStore } from "../storage/captureRunStore.js";
import { logger } from "../utils/logger.js";

export async function runCaptureDebug(): Promise<void> {
  const config = loadEnvConfig();
  const store = new CaptureRunStore(config);
  await store.createRun();
  const playwrightCli = new PlaywrightCli(config);

  await playwrightCli.open("about:blank");
  if (fs.existsSync(storageStatePath)) {
    await playwrightCli.stateLoad(storageStatePath);
  }
  await playwrightCli.goto(config.kindleUrl);
  const screenshotPath = store.getDebugScreenshotPath();
  await playwrightCli.screenshot(screenshotPath);
  logger.info({ screenshotPath }, "Saved debug screenshot.");
}
