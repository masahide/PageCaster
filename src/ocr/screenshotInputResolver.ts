import fs from "node:fs/promises";
import path from "node:path";
import { screenshotsDir } from "../config/paths.js";
import type { OcrInput } from "../types.js";
import { parsePageFilter } from "../cli/ocrOptions.js";
import { OcrAppError } from "../errors.js";

const pageFilePattern = /^page-(\d+)\.png$/;

export class ScreenshotInputResolver {
  async resolveByRunId(runId: string, pages?: string): Promise<OcrInput[]> {
    const runDir = path.join(screenshotsDir, runId);
    const entries = await fs.readdir(runDir).catch(() => {
      throw new OcrAppError(
        "INPUT_IMAGE_NOT_FOUND",
        `Screenshot run directory does not exist: ${runDir}`
      );
    });
    const filter = parsePageFilter(pages);

    return entries
      .map((entry) => {
        const match = entry.match(pageFilePattern);
        if (!match) {
          return undefined;
        }
        const index = Number(match[1]);
        if (filter && !filter.has(index)) {
          return undefined;
        }
        return {
          index,
          sourceImagePath: path.join(runDir, entry)
        };
      })
      .filter((input): input is OcrInput => Boolean(input))
      .sort((a, b) => a.index - b.index);
  }

  async resolveByImage(imagePath: string): Promise<OcrInput[]> {
    await fs.access(imagePath).catch(() => {
      throw new OcrAppError(
        "INPUT_IMAGE_NOT_FOUND",
        `Input image does not exist: ${imagePath}`
      );
    });
    const basename = path.basename(imagePath);
    const match = basename.match(pageFilePattern);

    return [
      {
        index: match ? Number(match[1]) : 1,
        sourceImagePath: path.resolve(imagePath)
      }
    ];
  }
}
