import fs from "node:fs/promises";
import { loadOcrConfig } from "../config/env.js";
import { OcrAppError } from "../errors.js";
import { NdloocrLiteRunner } from "../ocr/ndloocrLite.js";
import { OcrOutputReader } from "../ocr/ocrOutputReader.js";
import { OcrRunStore } from "../ocr/ocrRunStore.js";
import { ScreenshotInputResolver } from "../ocr/screenshotInputResolver.js";
import { logger } from "../utils/logger.js";
import type { OcrCliOptions } from "./ocrOptions.js";
import type { OcrError } from "../types.js";

export async function runOcr(options: OcrCliOptions): Promise<void> {
  const config = loadOcrConfig();
  const resolver = new ScreenshotInputResolver();
  let inputs;
  try {
    inputs = options.runId
      ? await resolver.resolveByRunId(options.runId, options.pages)
      : await resolver.resolveByImage(options.image!);
  } catch (error) {
    if (error instanceof OcrAppError) {
      logger.error({ code: error.code, error: error.message }, "OCR failed.");
    }
    throw error;
  }

  if (inputs.length === 0) {
    throw new OcrAppError(
      "INPUT_IMAGE_NOT_FOUND",
      "No screenshot images matched the OCR input options."
    );
  }

  const store = new OcrRunStore(config, options.runId);
  await store.createRun();
  const runner = new NdloocrLiteRunner(config);
  const reader = new OcrOutputReader();
  let hasErrors = false;

  for (const input of inputs) {
    const outputDir = store.getPageOutputDir(input.index);
    const startedAt = Date.now();

    try {
      await fs.mkdir(outputDir, { recursive: true });
      const processResult = await runner.run(input, outputDir);
      const text = (await reader.readText(outputDir)).trim();
      const jsonPath = await reader.findJson(outputDir);
      const textPath = await reader.findText(outputDir);

      if (!jsonPath && !textPath) {
        throw new OcrAppError(
          "OCR_OUTPUT_NOT_FOUND",
          "NDLOCR-Lite did not create a JSON or text output.",
          input.index
        );
      }

      if (!text) {
        throw new OcrAppError(
          "EMPTY_OCR_RESULT",
          "NDLOCR-Lite output did not contain text.",
          input.index
        );
      }

      await store.appendPage({
        index: input.index,
        sourceImagePath: input.sourceImagePath,
        outputDir,
        textPath,
        jsonPath,
        textLength: text.length,
        elapsedMs: processResult.elapsedMs || Date.now() - startedAt
      });
      logger.info(
        {
          pageIndex: input.index,
          sourceImagePath: input.sourceImagePath,
          outputDir,
          textLength: text.length
        },
        "OCR completed."
      );
    } catch (error) {
      const ocrError =
        error instanceof OcrAppError
          ? error
          : toProcessOcrError(error, input.index);
      await store.appendError(toOcrError(ocrError));
      hasErrors = true;
      logger.error(
        { pageIndex: input.index, code: ocrError.code, error: ocrError.message },
        "OCR failed."
      );
    }
  }

  await store.completeRun();
  logger.info({ metadataPath: store.getMetadataPath() }, "OCR run completed.");

  if (hasErrors) {
    throw new OcrAppError(
      "OCR_PROCESS_FAILED",
      "One or more OCR pages failed. See ocr-run.json for details."
    );
  }
}

function toProcessOcrError(error: unknown, pageIndex: number): OcrAppError {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("ENOENT")) {
    return new OcrAppError("OCR_ENGINE_NOT_FOUND", message, pageIndex);
  }

  return new OcrAppError("OCR_PROCESS_FAILED", message, pageIndex);
}

function toOcrError(error: OcrAppError): OcrError {
  return {
    code: error.code,
    message: error.message,
    pageIndex: error.pageIndex,
    occurredAt: new Date().toISOString()
  };
}
