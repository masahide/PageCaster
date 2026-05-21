import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { EnvConfig } from "../types.js";

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export type CommandRunner = (
  command: string,
  args: string[]
) => Promise<CommandResult>;

export const spawnCommandRunner: CommandRunner = (command, args) =>
  new Promise((resolve, reject) => {
    const invocation = resolveInvocation(command, args);
    const child = spawn(invocation.command, invocation.args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `${invocation.command} ${invocation.args.join(" ")} failed with exit code ${code}\n${stderr || stdout}`
        )
      );
    });
  });

function resolveInvocation(
  command: string,
  args: string[]
): { command: string; args: string[] } {
  if (path.isAbsolute(command)) {
    return { command, args };
  }

  if (command === "playwright-cli") {
    const localScript = path.join(
      process.cwd(),
      "node_modules",
      "@playwright",
      "cli",
      "playwright-cli.js"
    );

    if (fs.existsSync(localScript)) {
      return {
        command: process.execPath,
        args: [localScript, ...args]
      };
    }
  }

  return { command, args };
}

export class PlaywrightCli {
  constructor(
    private readonly config: EnvConfig,
    private readonly runner: CommandRunner = spawnCommandRunner
  ) {}

  openArgs(url = this.config.kindleUrl): string[] {
    return [
      `-s=${this.config.playwrightCliSession}`,
      "open",
      url,
      ...(this.config.headless ? [] : ["--headed"]),
      ...(this.config.browserChannel
        ? [`--browser=${this.config.browserChannel}`]
        : [])
    ];
  }

  async open(url = this.config.kindleUrl): Promise<CommandResult> {
    return this.run(this.openArgs(url));
  }

  async goto(url = this.config.kindleUrl): Promise<CommandResult> {
    return this.run([`-s=${this.config.playwrightCliSession}`, "goto", url]);
  }

  async stateSave(path: string): Promise<CommandResult> {
    return this.run([
      `-s=${this.config.playwrightCliSession}`,
      "state-save",
      path
    ]);
  }

  async stateLoad(path: string): Promise<CommandResult> {
    return this.run([
      `-s=${this.config.playwrightCliSession}`,
      "state-load",
      path
    ]);
  }

  async screenshot(path: string): Promise<CommandResult> {
    return this.run([
      `-s=${this.config.playwrightCliSession}`,
      "screenshot",
      `--filename=${path}`
    ]);
  }

  async press(key: string): Promise<CommandResult> {
    return this.run([`-s=${this.config.playwrightCliSession}`, "press", key]);
  }

  async mousemove(x: number, y: number): Promise<CommandResult> {
    return this.run([
      `-s=${this.config.playwrightCliSession}`,
      "mousemove",
      String(x),
      String(y)
    ]);
  }

  async click(target: string): Promise<CommandResult> {
    return this.run([`-s=${this.config.playwrightCliSession}`, "click", target]);
  }

  async runCode(code: string): Promise<CommandResult> {
    return this.run([`-s=${this.config.playwrightCliSession}`, "run-code", code]);
  }

  async tabList(): Promise<CommandResult> {
    return this.run([`-s=${this.config.playwrightCliSession}`, "tab-list"]);
  }

  async tabSelect(index: number): Promise<CommandResult> {
    return this.run([
      `-s=${this.config.playwrightCliSession}`,
      "tab-select",
      String(index)
    ]);
  }

  async close(): Promise<CommandResult> {
    return this.run([`-s=${this.config.playwrightCliSession}`, "close"]);
  }

  private async run(args: string[]): Promise<CommandResult> {
    return this.runner(this.config.playwrightCliCommand, args);
  }
}
