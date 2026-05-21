import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvConfig } from "../../src/types.js";

const config: EnvConfig = {
  kindleUrl: "https://read.amazon.co.jp/",
  headless: false,
  browserChannel: undefined,
  playwrightCliCommand: "playwright-cli",
  playwrightCliSession: "pagecaster",
  viewport: {
    width: 1600,
    height: 1200
  },
  clip: {
    x: 160,
    y: 80,
    width: 1280,
    height: 1040
  },
  pageChangeTimeoutMs: 10000,
  pageChangePollMs: 250,
  pageTurnKey: "ArrowLeft"
};

let tempDir: string;
let originalCwd: string;

describe("CaptureRunStore", () => {
  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pagecaster-"));
    vi.resetModules();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("creates metadata and stable screenshot paths", async () => {
    const { CaptureRunStore: FreshCaptureRunStore } = await import(
      "../../src/storage/captureRunStore.js"
    );
    const store = new FreshCaptureRunStore(config, "20260522-000001");

    await store.createRun();
    await store.appendPage({
      index: 1,
      screenshotPath: store.getScreenshotPath(1),
      sha256: "abc",
      capturedAt: "2026-05-22T00:00:00.000Z"
    });

    const metadata = JSON.parse(
      await fs.readFile(store.getMetadataPath(), "utf8")
    );

    expect(metadata.pages).toHaveLength(1);
    expect(metadata.pages[0].screenshotPath).toContain("page-000001.png");
  });
});
