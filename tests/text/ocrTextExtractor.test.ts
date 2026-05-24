import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OcrTextExtractor } from "../../src/text/ocrTextExtractor.js";

let tempDir: string;

describe("OcrTextExtractor", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pagecaster-text-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("recursively extracts text-like fields", async () => {
    const jsonPath = path.join(tempDir, "page.json");
    await fs.writeFile(
      jsonPath,
      JSON.stringify({ lines: [{ text: "吾輩は" }, { text: "猫である。" }] }),
      "utf8"
    );

    await expect(new OcrTextExtractor().extract(jsonPath)).resolves.toBe(
      "吾輩は\n猫である。"
    );
  });

  it("does not include image paths as body text", async () => {
    const jsonPath = path.join(tempDir, "page.json");
    await fs.writeFile(
      jsonPath,
      JSON.stringify({
        img_path: "C:\\book\\page-000001.png",
        lines: [{ text: "本文だけ。" }]
      }),
      "utf8"
    );

    await expect(new OcrTextExtractor().extract(jsonPath)).resolves.toBe(
      "本文だけ。"
    );
  });
});
