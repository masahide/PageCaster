import { Command } from "commander";
import { parsePageCount, parseTurnMode, type TurnMode } from "./options.js";

type ProgramHandlers = {
  login: () => Promise<void>;
  capture: (
    pages: number,
    turnMode: TurnMode,
    confirmStart: boolean
  ) => Promise<void>;
  captureDebug: () => Promise<void>;
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
    .command("capture:debug")
    .description("Save a full viewport debug screenshot")
    .action(handlers.captureDebug);

  return program;
}
