import fs from "node:fs/promises";
import path from "node:path";
import { textDir } from "../config/paths.js";
import { createRunId } from "../storage/runId.js";
import type {
  PreparedTextPage,
  TextChunk,
  TextPrepConfig,
  TextPrepError,
  LlmCallLog,
  TextRun
} from "../types.js";

export type TextPageFiles = {
  index: number;
  sourceJsonPath: string;
  rawText: string;
  normalizedText: string;
  correctedText: string;
  usedLlm: boolean;
  elapsedMs: number;
  skipReason?: "TOC";
};

export class TextRunStore {
  private run?: TextRun;

  constructor(
    private readonly config: TextPrepConfig,
    private readonly sourceOcrRunId?: string,
    private readonly runId = sourceOcrRunId ?? `single-${createRunId()}`
  ) {}

  getRunId(): string {
    return this.runId;
  }

  getRunDir(): string {
    return path.join(textDir, this.runId);
  }

  getMetadataPath(): string {
    return path.join(this.getRunDir(), "text-run.json");
  }

  getChunksPath(): string {
    return path.join(this.getRunDir(), "chunks.json");
  }

  async createRun(): Promise<TextRun> {
    this.run = {
      runId: this.runId,
      sourceOcrRunId: this.sourceOcrRunId,
      llmEnabled: this.config.llmEnabled,
      llmModel: this.config.llmModel,
      startedAt: new Date().toISOString(),
      pages: [],
      chunks: [],
      errors: [],
      llmCalls: []
    };

    await fs.mkdir(this.getRunDir(), { recursive: true });
    await this.persist();
    return this.run;
  }

  async writePageFiles(files: TextPageFiles): Promise<PreparedTextPage> {
    await fs.mkdir(this.getRunDir(), { recursive: true });

    const prefix = `page-${String(files.index).padStart(6, "0")}`;
    const rawTextPath = path.join(this.getRunDir(), `${prefix}.raw.txt`);
    const normalizedTextPath = path.join(this.getRunDir(), `${prefix}.normalized.txt`);
    const correctedTextPath = path.join(this.getRunDir(), `${prefix}.corrected.txt`);

    await fs.writeFile(rawTextPath, files.rawText, "utf8");
    await fs.writeFile(normalizedTextPath, files.normalizedText, "utf8");
    await fs.writeFile(correctedTextPath, files.correctedText, "utf8");

    const page: PreparedTextPage = {
      index: files.index,
      sourceJsonPath: files.sourceJsonPath,
      rawTextPath,
      normalizedTextPath,
      correctedTextPath,
      rawTextLength: files.rawText.length,
      correctedTextLength: files.correctedText.length,
      usedLlm: files.usedLlm,
      elapsedMs: files.elapsedMs,
      skipReason: files.skipReason
    };

    this.ensureRun().pages.push(page);
    await this.persist();
    return page;
  }

  async writeChunks(chunks: TextChunk[]): Promise<void> {
    this.ensureRun().chunks = chunks;
    await fs.writeFile(
      this.getChunksPath(),
      `${JSON.stringify(chunks, null, 2)}\n`,
      "utf8"
    );
    await this.persist();
  }

  async appendError(error: TextPrepError): Promise<void> {
    this.ensureRun().errors.push(error);
    await this.persist();
  }

  async appendLlmCall(call: LlmCallLog): Promise<void> {
    const run = this.ensureRun();
    run.llmCalls ??= [];
    run.llmCalls.push(call);
    await this.persist();
  }

  async writeLlmDebugArtifact(
    callId: string,
    payload: unknown
  ): Promise<string> {
    const debugDir = path.join(this.getRunDir(), "debug", "llm");
    await fs.mkdir(debugDir, { recursive: true });
    const debugPath = path.join(debugDir, `${safeFileName(callId)}.json`);
    await fs.writeFile(debugPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return debugPath;
  }

  async updateMetadata(
    metadata: Partial<
      Pick<
        TextRun,
        | "splitMode"
        | "pageBreakJoin"
        | "textChunkMaxChars"
        | "llmBoundaryEnabled"
        | "llmDebugSaveResponses"
        | "skippedPages"
        | "pageBreakJoinCount"
        | "boundarySelection"
      >
    >
  ): Promise<void> {
    Object.assign(this.ensureRun(), metadata);
    await this.persist();
  }

  async completeRun(): Promise<void> {
    this.ensureRun().completedAt = new Date().toISOString();
    await this.persist();
  }

  private ensureRun(): TextRun {
    if (!this.run) {
      throw new Error("Text run has not been created.");
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

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_");
}
