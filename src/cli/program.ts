import { Command } from "commander";
import { parsePageCount, parseTurnMode, type TurnMode } from "./options.js";
import { validateOcrCliOptions, type OcrCliOptions } from "./ocrOptions.js";
import {
  validatePrepareTextOptions,
  type PrepareTextOptions
} from "../text/prepareTextOptions.js";

type ProgramHandlers = {
  login: () => Promise<void>;
  capture: (
    pages: number,
    turnMode: TurnMode,
    confirmStart: boolean
  ) => Promise<void>;
  captureDebug: () => Promise<void>;
  ocr: (options: OcrCliOptions) => Promise<void>;
  prepareText: (options: PrepareTextOptions) => Promise<void>;
};

export function createProgram(handlers: ProgramHandlers): Command {
  const program = new Command();

  program.name("pagecaster").description("Kindle screenshot capture CLI");

  program
    .command("login")
    .description("Open Kindle Cloud Reader and save Playwright storage state")
    .action(handlers.login);

  program
    .command("capture")
    .description("Capture Kindle page screenshots")
    .option("--pages <number>", "number of pages to capture", "1")
    .option(
      "--turn-mode <mode>",
      "page turn mode: auto or manual",
      "auto"
    )
    .option("--no-confirm-start", "skip waiting for Enter before first capture")
    .action(async (options: {
      pages: string;
      turnMode: string;
      confirmStart: boolean;
    }) => {
      await handlers.capture(
        parsePageCount(options.pages),
        parseTurnMode(options.turnMode),
        options.confirmStart
      );
    });

  program
    .command("ocr")
    .description("Run OCR for captured screenshots")
    .option("--run-id <runId>", "capture run id to OCR")
    .option("--image <path>", "single image path to OCR")
    .option("--pages <filter>", "page filter: 1, 1-5, or 1,3,5")
    .action(async (options: OcrCliOptions) => {
      validateOcrCliOptions(options);
      await handlers.ocr(options);
    });

  program
    .command("prepare-text")
    .description("Prepare OCR text for TTS chunks")
    .option("--ocr-run-id <runId>", "OCR run id to prepare")
    .option("--ocr-json <path>", "single OCR JSON path to prepare")
    .option("--pages <filter>", "page filter: 1, 1-5, or 1,3,5")
    .option("--exclude-toc", "skip pages that look like a table of contents")
    .option("--no-ocr-correction", "disable optional LLM OCR correction after chunking")
    .action(async (options: PrepareTextOptions) => {
      validatePrepareTextOptions(options);
      await handlers.prepareText(options);
    });

  program
    .command("capture:debug")
    .description("Save a full viewport debug screenshot")
    .action(handlers.captureDebug);

  return program;
}
