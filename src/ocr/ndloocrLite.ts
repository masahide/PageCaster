import { spawn } from "node:child_process";
import path from "node:path";
import type { OcrConfig, OcrInput } from "../types.js";

export type ProcessRunner = (
  command: string,
  args: string[],
  timeoutMs: number
) => Promise<{ stdout: string; stderr: string }>;

export type OcrProcessResult = {
  stdout: string;
  stderr: string;
  elapsedMs: number;
};

export const spawnProcessRunner: ProcessRunner = (command, args, timeoutMs) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with exit code ${code}\n${stderr || stdout}`
        )
      );
    });
  });

export class NdloocrLiteRunner {
  constructor(
    private readonly config: OcrConfig,
    private readonly runner: ProcessRunner = spawnProcessRunner
  ) {}

  buildInvocation(input: OcrInput, outputDir: string): {
    command: string;
    args: string[];
  } {
    const baseArgs = [
      "--sourceimg",
      input.sourceImagePath,
      "--output",
      outputDir
    ];

    if (this.config.ndloocrLiteJsonOnly) {
      baseArgs.push("--json-only");
    }

    if (this.config.ndloocrLiteEnableTcy) {
      baseArgs.push("--enable-tcy");
    }

    if (this.config.ndloocrLiteSrcDir) {
      return {
        command: this.config.ndloocrLitePython ?? "python",
        args: [
          path.join(this.config.ndloocrLiteSrcDir, "ocr.py"),
          ...baseArgs
        ]
      };
    }

    return {
      command: this.config.ndloocrLiteCommand,
      args: baseArgs
    };
  }

  async run(input: OcrInput, outputDir: string): Promise<OcrProcessResult> {
    const startedAt = Date.now();
    const invocation = this.buildInvocation(input, outputDir);
    const result = await this.runner(
      invocation.command,
      invocation.args,
      this.config.ocrTimeoutMs
    );

    return {
      ...result,
      elapsedMs: Date.now() - startedAt
    };
  }
}
