import { describe, expect, it } from "vitest";
import {
  loadEnvConfig,
  loadOcrConfig,
  loadTextPrepConfig
} from "../../src/config/env.js";

describe("loadEnvConfig", () => {
  it("applies defaults for optional values", () => {
    const config = loadEnvConfig({
      KINDLE_URL: "https://read.amazon.co.jp/"
    });

    expect(config).toEqual({
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
    });
  });

  it("rejects a clip outside the viewport", () => {
    expect(() =>
      loadEnvConfig({
        KINDLE_URL: "https://read.amazon.co.jp/",
        VIEWPORT_WIDTH: "100",
        VIEWPORT_HEIGHT: "100",
        CAPTURE_CLIP_X: "50",
        CAPTURE_CLIP_Y: "50",
        CAPTURE_CLIP_WIDTH: "80",
        CAPTURE_CLIP_HEIGHT: "80"
      })
    ).toThrow(/CAPTURE_CLIP/);
  });

  it("rejects invalid urls", () => {
    expect(() => loadEnvConfig({ KINDLE_URL: "not-a-url" })).toThrow(
      /KINDLE_URL/
    );
  });

  it("accepts a browser channel", () => {
    const config = loadEnvConfig({
      KINDLE_URL: "https://read.amazon.co.jp/",
      BROWSER_CHANNEL: "chrome"
    });

    expect(config.browserChannel).toBe("chrome");
  });
});

describe("loadOcrConfig", () => {
  it("applies NDLOCR-Lite defaults", () => {
    const config = loadOcrConfig({});

    expect(config).toEqual({
      engine: "ndloocr-lite",
      ndloocrLiteCommand:
        process.platform === "win32" ? "ndlocr-lite.exe" : "ndlocr-lite",
      ndloocrLitePython: undefined,
      ndloocrLiteSrcDir: undefined,
      ndloocrLiteJsonOnly: true,
      ndloocrLiteEnableTcy: false,
      ocrTimeoutMs: 120000
    });
  });

  it("accepts explicit NDLOCR-Lite settings", () => {
    const config = loadOcrConfig({
      OCR_ENGINE: "ndloocr-lite",
      NDLOCR_LITE_COMMAND: "ndlocr-lite.exe",
      NDLOCR_LITE_JSON_ONLY: "false",
      NDLOCR_LITE_ENABLE_TCY: "false",
      OCR_TIMEOUT_MS: "3000"
    });

    expect(config).toMatchObject({
      ndloocrLiteCommand: "ndlocr-lite.exe",
      ndloocrLiteJsonOnly: false,
      ndloocrLiteEnableTcy: false,
      ocrTimeoutMs: 3000
    });
  });

  it("rejects unsupported OCR engines", () => {
    expect(() => loadOcrConfig({ OCR_ENGINE: "paddleocr" })).toThrow(
      /OCR_ENGINE/
    );
  });
});

describe("loadTextPrepConfig", () => {
  it("applies LM Studio defaults", () => {
    expect(loadTextPrepConfig({})).toEqual({
      llmEnabled: true,
      llmProvider: "lmstudio",
      llmBaseUrl: "http://192.168.10.37:1234/v1",
      llmModel: undefined,
      llmTimeoutMs: 1200000,
      llmCorrectionMode: "anchor",
      llmMaxEditRatio: 0.25,
      llmMaxTokens: 10000,
      llmMaxFixesPerChunk: 5,
      llmMaxAnchorChars: 40,
      llmMaxFixRatio: 0.25,
      llmDebugSaveResponses: true,
      textChunkMaxChars: 240,
      textChunkMinChars: 40,
      textSplitMode: "local",
      textEnableLlmBoundary: false,
      textPageBreakJoin: true
    });
  });

  it("rejects invalid chunk ranges", () => {
    expect(() =>
      loadTextPrepConfig({
        TEXT_CHUNK_MAX_CHARS: "40",
        TEXT_CHUNK_MIN_CHARS: "80"
      })
    ).toThrow(/TEXT_CHUNK_MIN_CHARS/);
  });
});
