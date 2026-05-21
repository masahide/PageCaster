import fsPromises from "node:fs/promises";
import fs from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadEnvConfig } from "../config/env.js";
import { storageStatePath } from "../config/paths.js";
import { AppError } from "../errors.js";
import { PlaywrightCli } from "../browser/playwrightCli.js";
import { ImageHasher } from "../capture/hashImage.js";
import { PageChangeWatcher } from "../capture/waitForPageChange.js";
import { CaptureRunStore } from "../storage/captureRunStore.js";
import { logger } from "../utils/logger.js";
import type { CapturedPage } from "../types.js";
import type { TurnMode } from "./options.js";

export async function runCapture(
  pages: number,
  turnMode: TurnMode = "auto",
  confirmStart = true
): Promise<void> {
  const config = loadEnvConfig();
  const store = new CaptureRunStore(config);
  await store.createRun();

  if (!fs.existsSync(storageStatePath)) {
    const error = new AppError(
      "NOT_LOGGED_IN",
      "storage-state.json does not exist. Run pnpm kindle:login first."
    );
    await store.appendError(toCaptureError(error));
    throw error;
  }

  const playwrightCli = new PlaywrightCli(config);
  const hasher = new ImageHasher();
  const watcher = new PageChangeWatcher({
    timeoutMs: config.pageChangeTimeoutMs,
    pollMs: config.pageChangePollMs,
    captureBuffer: async () => {
      const probePath = store.getProbeScreenshotPath();
      await playwrightCli.screenshot(probePath);
      return fsPromises.readFile(probePath);
    },
    hasher
  });

  try {
    await ensureCaptureSession(playwrightCli, storageStatePath, config.kindleUrl);
    await selectLikelyReaderTab(playwrightCli);
    if (confirmStart) {
      await waitForUserToOpenBook();
    }

    for (let pageIndex = 1; pageIndex <= pages; pageIndex += 1) {
      const screenshotPath = store.getScreenshotPath(pageIndex);
      const captured = await captureWithCli(
        playwrightCli,
        hasher,
        pageIndex,
        screenshotPath
      );
      await store.appendPage(captured);
      logger.info(
        { pageIndex, screenshotPath, sha256: captured.sha256 },
        "Captured page."
      );

      if (pageIndex < pages) {
        if (turnMode === "auto") {
          await turnPage(
            playwrightCli,
            config.pageTurnKey
          );
          await watcher.waitForChange(captured.sha256, pageIndex + 1);
        } else {
          await waitForManualPageTurn(pageIndex + 1);
        }
      }
    }
    await fsPromises.rm(store.getProbeScreenshotPath(), { force: true });
  } catch (error) {
    if (error instanceof AppError) {
      await store.appendError(toCaptureError(error));
    }
    throw error;
  }
}

async function selectLikelyReaderTab(playwrightCli: PlaywrightCli): Promise<void> {
  const tabs = await playwrightCli.tabList();
  const lines = tabs.stdout.split(/\r?\n/);
  const readerTabLine = lines.find(
    (line) =>
      !line.includes("(current)") &&
      line.includes("read.amazon") &&
      (line.includes("?asin=") || line.includes("/reader/"))
  );
  const match = readerTabLine?.match(/-\s+(\d+):/);

  if (!match) {
    return;
  }

  const tabIndex = Number(match[1]);
  await playwrightCli.tabSelect(tabIndex);
  logger.info({ tabIndex }, "Selected likely Kindle reader tab.");
}

async function waitForManualPageTurn(nextPageIndex: number): Promise<void> {
  process.stdout.write(
    `Turn to page ${nextPageIndex} manually in the browser, then press Enter here.\n`
  );
  const rl = createInterface({ input, output });
  await rl.question("Press Enter after the next page is visible...\n");
  rl.close();
}

async function turnPage(
  playwrightCli: PlaywrightCli,
  pageTurnKey: string
): Promise<void> {
  await playwrightCli.runCode(
    `async (page) => {
      await page.evaluate(() => window.focus());
      await page.keyboard.press(${JSON.stringify(pageTurnKey)});
    }`
  );
}

async function ensureCaptureSession(
  playwrightCli: PlaywrightCli,
  storageStatePath: string,
  kindleUrl: string
): Promise<void> {
  try {
    await playwrightCli.screenshot("__pagecaster-session-probe.png");
    await fsPromises.rm("__pagecaster-session-probe.png", { force: true });
    logger.info("Using the existing playwright-cli session.");
    return;
  } catch {
    logger.info("No active playwright-cli session found. Opening Kindle Cloud Reader.");
  }

  await playwrightCli.open("about:blank");
  await playwrightCli.stateLoad(storageStatePath);
  await playwrightCli.goto(kindleUrl);
}

async function waitForUserToOpenBook(): Promise<void> {
  process.stdout.write(
    "Open the target Kindle book and first page in the browser, then press Enter here.\n"
  );
  const rl = createInterface({ input, output });
  await rl.question("Press Enter after the book page is visible...\n");
  rl.close();
}

function toCaptureError(error: AppError) {
  return {
    code: error.code,
    message: error.message,
    pageIndex: error.pageIndex,
    occurredAt: new Date().toISOString()
  };
}

async function captureWithCli(
  playwrightCli: PlaywrightCli,
  hasher: ImageHasher,
  index: number,
  screenshotPath: string
): Promise<CapturedPage> {
  await playwrightCli.screenshot(screenshotPath);
  const buffer = await fsPromises.readFile(screenshotPath);

  return {
    index,
    screenshotPath,
    sha256: hasher.sha256(buffer),
    capturedAt: new Date().toISOString()
  };
}
