import { createProgram } from "./program.js";
import { runLogin } from "./login.js";
import { runCapture } from "./capture.js";
import { runCaptureDebug } from "./capture-debug.js";
import { runOcr } from "./ocr.js";
import { runPrepareText } from "./prepare-text.js";
import { logger } from "../utils/logger.js";

const program = createProgram({
  login: runLogin,
  capture: runCapture,
  captureDebug: runCaptureDebug,
  ocr: runOcr,
  prepareText: runPrepareText
});

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof Error) {
    logger.error({ error: error.message }, "Command failed.");
  } else {
    logger.error({ error }, "Command failed.");
  }
  process.exitCode = 1;
}
