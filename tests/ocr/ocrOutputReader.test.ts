import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OcrOutputReader } from "../../src/ocr/ocrOutputReader.js";

let tempDir: string;

describe("OcrOutputReader", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pagecaster-ocr-output-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("finds and reads text files", async () => {
    await fs.writeFile(path.join(tempDir, "result.txt"), "本文", "utf8");
    const reader = new OcrOutputReader();

    await expect(reader.findText(tempDir)).resolves.toContain("result.txt");
    await expect(reader.readText(tempDir)).resolves.toBe("本文");
  });

  it("extracts text-like values from json files", async () => {
    await fs.writeFile(
      path.join(tempDir, "result.json"),
      JSON.stringify({ blocks: [{ text: "縦書き" }, { text: "OCR" }] }),
      "utf8"
    );
    const reader = new OcrOutputReader();

    await expect(reader.readText(tempDir)).resolves.toContain("縦書き");
  });
});
