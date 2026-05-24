import "dotenv/config";
import { z } from "zod";
import type { EnvConfig, OcrConfig, TextPrepConfig } from "../types.js";

const numberFromEnv = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === "") {
      return defaultValue;
    }
    return Number(value);
  }, z.number().int().positive());

const booleanFromEnv = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === "") {
      return defaultValue;
    }
    if (typeof value === "boolean") {
      return value;
    }
    return String(value).toLowerCase() === "true";
  }, z.boolean());

const defaultNdloocrLiteCommand =
  process.platform === "win32" ? "ndlocr-lite.exe" : "ndlocr-lite";

const rawEnvSchema = z.object({
  KINDLE_URL: z.string().url().default("https://read.amazon.co.jp/"),
  HEADLESS: booleanFromEnv(false),
  BROWSER_CHANNEL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional()
  ),
  PLAYWRIGHT_CLI_COMMAND: z.string().default("playwright-cli"),
  PLAYWRIGHT_CLI_SESSION: z.string().default("pagecaster"),
  VIEWPORT_WIDTH: numberFromEnv(1600),
  VIEWPORT_HEIGHT: numberFromEnv(1200),
  CAPTURE_CLIP_X: numberFromEnv(160),
  CAPTURE_CLIP_Y: numberFromEnv(80),
  CAPTURE_CLIP_WIDTH: numberFromEnv(1280),
  CAPTURE_CLIP_HEIGHT: numberFromEnv(1040),
  PAGE_CHANGE_TIMEOUT_MS: numberFromEnv(10000),
  PAGE_CHANGE_POLL_MS: numberFromEnv(250),
  PAGE_TURN_KEY: z.string().default("ArrowLeft"),
  OCR_ENGINE: z.literal("ndloocr-lite").default("ndloocr-lite"),
  NDLOCR_LITE_COMMAND: z.string().default(defaultNdloocrLiteCommand),
  NDLOCR_LITE_PYTHON: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional()
  ),
  NDLOCR_LITE_SRC_DIR: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional()
  ),
  NDLOCR_LITE_JSON_ONLY: booleanFromEnv(true),
  NDLOCR_LITE_ENABLE_TCY: booleanFromEnv(false),
  OCR_TIMEOUT_MS: numberFromEnv(120000),
  LLM_ENABLED: booleanFromEnv(true),
  LLM_PROVIDER: z.literal("lmstudio").default("lmstudio"),
  LLM_BASE_URL: z.string().url().default("http://192.168.10.37:1234/v1"),
  LLM_MODEL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional()
  ),
  LLM_TIMEOUT_MS: numberFromEnv(1200000),
  LLM_CORRECTION_MODE: z.enum(["edits", "anchor"]).default("anchor"),
  LLM_MAX_TOKENS: numberFromEnv(10000),
  LLM_MAX_EDIT_RATIO: z.preprocess((value) => {
    if (value === undefined || value === "") {
      return 0.25;
    }
    return Number(value);
  }, z.number().positive().max(1)),
  LLM_MAX_FIXES_PER_CHUNK: numberFromEnv(5),
  LLM_MAX_ANCHOR_CHARS: numberFromEnv(40),
  LLM_MAX_FIX_RATIO: z.preprocess((value) => {
    if (value === undefined || value === "") {
      return 0.25;
    }
    return Number(value);
  }, z.number().positive().max(1)),
  LLM_DEBUG_SAVE_RESPONSES: booleanFromEnv(true),
  TEXT_CHUNK_MAX_CHARS: numberFromEnv(240),
  TEXT_CHUNK_MIN_CHARS: numberFromEnv(40),
  TEXT_SPLIT_MODE: z.enum(["local", "llm"]).default("local"),
  TEXT_ENABLE_LLM_BOUNDARY: booleanFromEnv(false),
  TEXT_PAGE_BREAK_JOIN: booleanFromEnv(true)
});

export function loadEnvConfig(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  const parsed = rawEnvSchema.parse(env);
  const clipRight = parsed.CAPTURE_CLIP_X + parsed.CAPTURE_CLIP_WIDTH;
  const clipBottom = parsed.CAPTURE_CLIP_Y + parsed.CAPTURE_CLIP_HEIGHT;

  if (clipRight > parsed.VIEWPORT_WIDTH || clipBottom > parsed.VIEWPORT_HEIGHT) {
    throw new Error(
      "CAPTURE_CLIP values must fit within VIEWPORT_WIDTH and VIEWPORT_HEIGHT"
    );
  }

  return {
    kindleUrl: parsed.KINDLE_URL,
    headless: parsed.HEADLESS,
    browserChannel: parsed.BROWSER_CHANNEL,
    playwrightCliCommand: parsed.PLAYWRIGHT_CLI_COMMAND,
    playwrightCliSession: parsed.PLAYWRIGHT_CLI_SESSION,
    viewport: {
      width: parsed.VIEWPORT_WIDTH,
      height: parsed.VIEWPORT_HEIGHT
    },
    clip: {
      x: parsed.CAPTURE_CLIP_X,
      y: parsed.CAPTURE_CLIP_Y,
      width: parsed.CAPTURE_CLIP_WIDTH,
      height: parsed.CAPTURE_CLIP_HEIGHT
    },
    pageChangeTimeoutMs: parsed.PAGE_CHANGE_TIMEOUT_MS,
    pageChangePollMs: parsed.PAGE_CHANGE_POLL_MS,
    pageTurnKey: parsed.PAGE_TURN_KEY
  };
}

export function loadOcrConfig(env: NodeJS.ProcessEnv = process.env): OcrConfig {
  const parsed = rawEnvSchema.parse(env);

  return {
    engine: parsed.OCR_ENGINE,
    ndloocrLiteCommand: parsed.NDLOCR_LITE_COMMAND,
    ndloocrLitePython: parsed.NDLOCR_LITE_PYTHON,
    ndloocrLiteSrcDir: parsed.NDLOCR_LITE_SRC_DIR,
    ndloocrLiteJsonOnly: parsed.NDLOCR_LITE_JSON_ONLY,
    ndloocrLiteEnableTcy: parsed.NDLOCR_LITE_ENABLE_TCY,
    ocrTimeoutMs: parsed.OCR_TIMEOUT_MS
  };
}

export function loadTextPrepConfig(
  env: NodeJS.ProcessEnv = process.env
): TextPrepConfig {
  const parsed = rawEnvSchema.parse(env);

  if (parsed.TEXT_CHUNK_MIN_CHARS > parsed.TEXT_CHUNK_MAX_CHARS) {
    throw new Error(
      "TEXT_CHUNK_MIN_CHARS must be less than or equal to TEXT_CHUNK_MAX_CHARS"
    );
  }

  return {
    llmEnabled: parsed.LLM_ENABLED,
    llmProvider: parsed.LLM_PROVIDER,
    llmBaseUrl: parsed.LLM_BASE_URL,
    llmModel: parsed.LLM_MODEL,
    llmTimeoutMs: parsed.LLM_TIMEOUT_MS,
    llmCorrectionMode: parsed.LLM_CORRECTION_MODE,
    llmMaxEditRatio: parsed.LLM_MAX_EDIT_RATIO,
    llmMaxTokens: parsed.LLM_MAX_TOKENS,
    llmMaxFixesPerChunk: parsed.LLM_MAX_FIXES_PER_CHUNK,
    llmMaxAnchorChars: parsed.LLM_MAX_ANCHOR_CHARS,
    llmMaxFixRatio: parsed.LLM_MAX_FIX_RATIO,
    llmDebugSaveResponses: parsed.LLM_DEBUG_SAVE_RESPONSES,
    textChunkMaxChars: parsed.TEXT_CHUNK_MAX_CHARS,
    textChunkMinChars: parsed.TEXT_CHUNK_MIN_CHARS,
    textSplitMode: parsed.TEXT_SPLIT_MODE,
    textEnableLlmBoundary: parsed.TEXT_ENABLE_LLM_BOUNDARY,
    textPageBreakJoin: parsed.TEXT_PAGE_BREAK_JOIN
  };
}
