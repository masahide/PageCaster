import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempDir: string;
let originalCwd: string;

describe("ScreenshotInputResolver", () => {
  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pagecaster-ocr-"));
    process.chdir(tempDir);
    vi.resetModules();
    await fs.mkdir(path.join(tempDir, "data", "screenshots", "run-1"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(tempDir, "data", "screenshots", "run-1", "page-000002.png"),
      "two"
    );
    await fs.writeFile(
      path.join(tempDir, "data", "screenshots", "run-1", "page-000001.png"),
      "one"
    );
    await fs.writeFile(
      path.join(tempDir, "data", "screenshots", "run-1", ".probe.png"),
      "probe"
    );
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("resolves page images by run id in page order", async () => {
    const { ScreenshotInputResolver } = await import(
      "../../src/ocr/screenshotInputResolver.js"
    );
    const inputs = await new ScreenshotInputResolver().resolveByRunId("run-1");

    expect(inputs.map((input) => input.index)).toEqual([1, 2]);
  });

  it("filters pages", async () => {
    const { ScreenshotInputResolver } = await import(
      "../../src/ocr/screenshotInputResolver.js"
    );
    const inputs = await new ScreenshotInputResolver().resolveByRunId(
      "run-1",
      "2"
    );

    expect(inputs.map((input) => input.index)).toEqual([2]);
  });

  it("throws INPUT_IMAGE_NOT_FOUND for missing single images", async () => {
    const { ScreenshotInputResolver } = await import(
      "../../src/ocr/screenshotInputResolver.js"
    );

    await expect(
      new ScreenshotInputResolver().resolveByImage("missing.png")
    ).rejects.toMatchObject({
      code: "INPUT_IMAGE_NOT_FOUND"
    });
  });
});
