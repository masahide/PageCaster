import fs from "node:fs/promises";
import path from "node:path";
import type { CaptureError, CapturedPage, CaptureRun, EnvConfig } from "../types.js";
import { captureRunsDir, screenshotsDir } from "../config/paths.js";
import { createRunId } from "./runId.js";

export class CaptureRunStore {
  private run?: CaptureRun;

  constructor(
    private readonly config: EnvConfig,
    private readonly runId = createRunId()
  ) {}

  getRunId(): string {
    return this.runId;
  }

  getScreenshotPath(index: number): string {
    return path.join(
      screenshotsDir,
      this.runId,
      `page-${String(index).padStart(6, "0")}.png`
    );
  }

  getDebugScreenshotPath(): string {
    return path.join(screenshotsDir, this.runId, "debug-full-page.png");
  }

  getProbeScreenshotPath(): string {
    return path.join(screenshotsDir, this.runId, ".page-change-probe.png");
  }

  getMetadataPath(): string {
    return path.join(captureRunsDir, `${this.runId}.json`);
  }

  async createRun(): Promise<CaptureRun> {
    this.run = {
      runId: this.runId,
      kindleUrl: this.config.kindleUrl,
      viewport: this.config.viewport,
      clip: this.config.clip,
      pages: [],
      errors: []
    };

    await fs.mkdir(path.join(screenshotsDir, this.runId), { recursive: true });
    await fs.mkdir(captureRunsDir, { recursive: true });
    await this.persist();

    return this.run;
  }

  async appendPage(page: CapturedPage): Promise<void> {
    this.ensureRun().pages.push(page);
    await this.persist();
  }

  async appendError(error: CaptureError): Promise<void> {
    this.ensureRun().errors.push(error);
    await this.persist();
  }

  private ensureRun(): CaptureRun {
    if (!this.run) {
      throw new Error("Capture run has not been created.");
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
