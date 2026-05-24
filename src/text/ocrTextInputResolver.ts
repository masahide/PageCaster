import fs from "node:fs/promises";
import path from "node:path";
import { ocrDir } from "../config/paths.js";
import { TextPrepAppError } from "../errors.js";
import type { OcrRun, OcrTextInput } from "../types.js";
import { parsePageFilter } from "../cli/ocrOptions.js";

export class OcrTextInputResolver {
  async resolveByOcrRunId(
    runId: string,
    pages?: string
  ): Promise<OcrTextInput[]> {
    const metadataPath = path.join(ocrDir, runId, "ocr-run.json");
    const metadata = await readOcrRun(metadataPath);
    const filter = parsePageFilter(pages);

    return metadata.pages
      .filter((page) => !filter || filter.has(page.index))
      .map((page) => {
        if (!page.jsonPath) {
          throw new TextPrepAppError(
            "INPUT_OCR_NOT_FOUND",
            `OCR page is missing jsonPath: ${page.index}`,
            page.index
          );
        }
        return {
          index: page.index,
          sourceJsonPath: page.jsonPath
        };
      });
  }

  async resolveByOcrJson(jsonPath: string): Promise<OcrTextInput[]> {
    await fs.access(jsonPath).catch(() => {
      throw new TextPrepAppError(
        "INPUT_OCR_NOT_FOUND",
        `OCR JSON does not exist: ${jsonPath}`
      );
    });
    return [
      {
        index: inferPageIndex(jsonPath),
        sourceJsonPath: path.resolve(jsonPath)
      }
    ];
  }
}

async function readOcrRun(metadataPath: string): Promise<OcrRun> {
  const raw = await fs.readFile(metadataPath, "utf8").catch(() => {
    throw new TextPrepAppError(
      "INPUT_OCR_NOT_FOUND",
      `OCR metadata does not exist: ${metadataPath}`
    );
  });
  return JSON.parse(raw) as OcrRun;
}

function inferPageIndex(jsonPath: string): number {
  const match = path.basename(jsonPath).match(/page-(\d+)/);
  return match ? Number(match[1]) : 1;
}
