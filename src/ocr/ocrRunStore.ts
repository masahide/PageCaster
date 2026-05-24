import fs from "node:fs/promises";
import path from "node:path";
import { ocrDir } from "../config/paths.js";
import { createRunId } from "../storage/runId.js";
import type { OcrConfig, OcrError, OcrPageResult, OcrRun } from "../types.js";

export class OcrRunStore {
  private run?: OcrRun;

  constructor(
    private readonly config: OcrConfig,
    private readonly sourceRunId?: string,
    private readonly runId = sourceRunId ?? `single-${createRunId()}`
  ) {}

  getRunId(): string {
    return this.runId;
  }

  getRunDir(): string {
    return path.join(ocrDir, this.runId);
  }

  getPageOutputDir(index: number): string {
    return path.join(this.getRunDir(), `page-${String(index).padStart(6, "0")}`);
  }

  getMetadataPath(): string {
    return path.join(this.getRunDir(), "ocr-run.json");
  }

  async createRun(): Promise<OcrRun> {
    this.run = {
      runId: this.runId,
      sourceRunId: this.sourceRunId,
      engine: this.config.engine,
      startedAt: new Date().toISOString(),
      pages: [],
      errors: []
    };

    await fs.mkdir(this.getRunDir(), { recursive: true });
    await this.persist();
    return this.run;
  }

  async appendPage(page: OcrPageResult): Promise<void> {
    this.ensureRun().pages.push(page);
    await this.persist();
  }

  async appendError(error: OcrError): Promise<void> {
    this.ensureRun().errors.push(error);
    await this.persist();
  }

  async completeRun(): Promise<void> {
    this.ensureRun().completedAt = new Date().toISOString();
    await this.persist();
  }

  private ensureRun(): OcrRun {
    if (!this.run) {
      throw new Error("OCR run has not been created.");
    }
    return this.run;
  }

  private async persist(): Promise<void> {
    await fs.writeFile(
      this.getMetadataPath(),
      `${JSON.stringify(this.ensureRun(), null, 2)}\n`,
      "utf8"
    );
  }
}
