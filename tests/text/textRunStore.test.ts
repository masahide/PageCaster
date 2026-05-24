import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TextPrepConfig } from "../../src/types.js";

let tempDir: string;
let originalCwd: string;

const config: TextPrepConfig = {
  llmEnabled: false,
  llmProvider: "lmstudio",
  llmBaseUrl: "http://192.168.10.37:1234/v1",
  llmTimeoutMs: 60000,
  llmCorrectionMode: "edits",
  llmMaxEditRatio: 0.25,
  llmMaxTokens: 5000,
  llmMaxFixesPerChunk: 5,
  llmMaxAnchorChars: 40,
  llmMaxFixRatio: 0.25,
  llmDebugSaveResponses: true,
  textChunkMaxChars: 240,
  textChunkMinChars: 40,
  textSplitMode: "local",
  textEnableLlmBoundary: false,
  textPageBreakJoin: true
};

describe("TextRunStore", () => {
  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pagecaster-text-store-"));
    process.chdir(tempDir);
    vi.resetModules();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("persists page text files, chunks, and metadata", async () => {
    const { TextRunStore } = await import("../../src/text/textRunStore.js");
    const store = new TextRunStore(config, "ocr-run-1");
    await store.createRun();

    await store.writePageFiles({
      index: 1,
      sourceJsonPath: path.join(tempDir, "page-000001.json"),
      rawText: "raw",
      normalizedText: "normalized",
      correctedText: "corrected",
      usedLlm: false,
      elapsedMs: 12
    });
    await store.writeChunks([
      { id: "p000001-c001", pageIndex: 1, order: 1, text: "corrected", charLength: 9 }
    ]);
    await store.completeRun();

    const runDir = path.join(tempDir, "data", "text", "ocr-run-1");
    await expect(fs.readFile(path.join(runDir, "page-000001.raw.txt"), "utf8")).resolves.toBe("raw");
    await expect(fs.readFile(path.join(runDir, "page-000001.normalized.txt"), "utf8")).resolves.toBe("normalized");
    await expect(fs.readFile(path.join(runDir, "page-000001.corrected.txt"), "utf8")).resolves.toBe("corrected");

    const metadata = JSON.parse(
      await fs.readFile(path.join(runDir, "text-run.json"), "utf8")
    );
    expect(metadata).toMatchObject({
      runId: "ocr-run-1",
      sourceOcrRunId: "ocr-run-1",
      llmEnabled: false,
      pages: [{ index: 1, correctedTextLength: 9 }],
      chunks: [{ id: "p000001-c001" }]
    });
  });
});
