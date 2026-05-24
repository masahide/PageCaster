import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrConfig } from "../../src/types.js";

const config: OcrConfig = {
  engine: "ndloocr-lite",
  ndloocrLiteCommand: "ndlocr-lite",
  ndloocrLiteJsonOnly: true,
  ndloocrLiteEnableTcy: true,
  ocrTimeoutMs: 120000
};

let tempDir: string;
let originalCwd: string;

describe("OcrRunStore", () => {
  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pagecaster-ocr-store-"));
    process.chdir(tempDir);
    vi.resetModules();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("creates metadata and appends page results", async () => {
    const { OcrRunStore } = await import("../../src/ocr/ocrRunStore.js");
    const store = new OcrRunStore(config, "capture-run", "capture-run");

    await store.createRun();
    await store.appendPage({
      index: 1,
      sourceImagePath: "page.png",
      outputDir: store.getPageOutputDir(1),
      textLength: 10,
      elapsedMs: 100
    });
    await store.completeRun();

    const metadata = JSON.parse(
      await fs.readFile(store.getMetadataPath(), "utf8")
    );
    expect(metadata.sourceRunId).toBe("capture-run");
    expect(metadata.pages).toHaveLength(1);
    expect(metadata.completedAt).toBeTruthy();
  });
});
