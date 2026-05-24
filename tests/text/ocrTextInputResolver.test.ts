import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempDir: string;
let originalCwd: string;

describe("OcrTextInputResolver", () => {
  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pagecaster-text-resolve-"));
    process.chdir(tempDir);
    vi.resetModules();
    await fs.mkdir(path.join(tempDir, "data", "ocr", "run-1"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(tempDir, "data", "ocr", "run-1", "ocr-run.json"),
      JSON.stringify({
        runId: "run-1",
        engine: "ndloocr-lite",
        startedAt: "now",
        pages: [
          { index: 1, jsonPath: path.join(tempDir, "page-000001.json") },
          { index: 2, jsonPath: path.join(tempDir, "page-000002.json") }
        ],
        errors: []
      }),
      "utf8"
    );
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("resolves OCR json paths from ocr-run metadata", async () => {
    const { OcrTextInputResolver } = await import(
      "../../src/text/ocrTextInputResolver.js"
    );
    const inputs = await new OcrTextInputResolver().resolveByOcrRunId(
      "run-1",
      "2"
    );

    expect(inputs).toEqual([
      { index: 2, sourceJsonPath: path.join(tempDir, "page-000002.json") }
    ]);
  });
});
