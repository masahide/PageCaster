import "dotenv/config";
import { z } from "zod";
import type { EnvConfig } from "../types.js";

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
  PAGE_TURN_KEY: z.string().default("ArrowLeft")
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
