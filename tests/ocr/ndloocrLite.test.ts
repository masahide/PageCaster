import { describe, expect, it, vi } from "vitest";
import { NdloocrLiteRunner } from "../../src/ocr/ndloocrLite.js";
import type { OcrConfig, OcrInput } from "../../src/types.js";

const input: OcrInput = {
  index: 1,
  sourceImagePath: "page.png"
};

const config: OcrConfig = {
  engine: "ndloocr-lite",
  ndloocrLiteCommand: "ndlocr-lite.exe",
  ndloocrLiteJsonOnly: true,
  ndloocrLiteEnableTcy: true,
  ocrTimeoutMs: 120000
};

describe("NdloocrLiteRunner", () => {
  it("builds command invocation for ndlocr-lite", () => {
    const runner = new NdloocrLiteRunner(config);

    expect(runner.buildInvocation(input, "out")).toEqual({
      command: "ndlocr-lite.exe",
      args: [
        "--sourceimg",
        "page.png",
        "--output",
        "out",
        "--json-only",
        "--enable-tcy"
      ]
    });
  });

  it("builds python invocation when src dir is configured", () => {
    const runner = new NdloocrLiteRunner({
      ...config,
      ndloocrLitePython: "python",
      ndloocrLiteSrcDir: "vendor/ndlocr-lite/src"
    });

    const invocation = runner.buildInvocation(input, "out");

    expect(invocation.command).toBe("python");
    expect(invocation.args[0]).toContain("ocr.py");
  });

  it("runs the configured command", async () => {
    const processRunner = vi.fn(async () => ({ stdout: "ok", stderr: "" }));
    const runner = new NdloocrLiteRunner(config, processRunner);

    const result = await runner.run(input, "out");

    expect(processRunner).toHaveBeenCalledWith(
      "ndlocr-lite.exe",
      expect.any(Array),
      120000
    );
    expect(result.stdout).toBe("ok");
  });

  it("propagates process failures", async () => {
    const processRunner = vi.fn(async () => {
      throw new Error("failed with exit code 1");
    });
    const runner = new NdloocrLiteRunner(config, processRunner);

    await expect(runner.run(input, "out")).rejects.toThrow(/exit code 1/);
  });

  it("passes timeout to the process runner", async () => {
    const processRunner = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const runner = new NdloocrLiteRunner(
      {
        ...config,
        ocrTimeoutMs: 3000
      },
      processRunner
    );

    await runner.run(input, "out");

    expect(processRunner).toHaveBeenCalledWith(
      "ndlocr-lite.exe",
      expect.any(Array),
      3000
    );
  });
});
