import { describe, expect, it, vi } from "vitest";
import { PlaywrightCli } from "../../src/browser/playwrightCli.js";
import type { EnvConfig } from "../../src/types.js";

const config: EnvConfig = {
  kindleUrl: "https://read.amazon.co.jp/",
  headless: false,
  browserChannel: "chrome",
  playwrightCliCommand: "playwright-cli",
  playwrightCliSession: "pagecaster",
  viewport: {
    width: 1600,
    height: 1200
  },
  clip: {
    x: 160,
    y: 80,
    width: 1280,
    height: 1040
  },
  pageChangeTimeoutMs: 10000,
  pageChangePollMs: 250,
  pageTurnKey: "ArrowLeft"
};

describe("PlaywrightCli", () => {
  it("builds headed open command args with browser channel", () => {
    const cli = new PlaywrightCli(config);

    expect(cli.openArgs()).toEqual([
      "-s=pagecaster",
      "open",
      "https://read.amazon.co.jp/",
      "--headed",
      "--browser=chrome"
    ]);
  });

  it("runs screenshot through playwright-cli", async () => {
    const runner = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const cli = new PlaywrightCli(config, runner);

    await cli.screenshot("data/screenshots/run/page-000001.png");

    expect(runner).toHaveBeenCalledWith("playwright-cli", [
      "-s=pagecaster",
      "screenshot",
      "--filename=data/screenshots/run/page-000001.png"
    ]);
  });

  it("runs state save and load through the named session", async () => {
    const runner = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const cli = new PlaywrightCli(config, runner);

    await cli.stateLoad("auth/storage-state.json");
    await cli.stateSave("auth/storage-state.json");

    expect(runner).toHaveBeenNthCalledWith(1, "playwright-cli", [
      "-s=pagecaster",
      "state-load",
      "auth/storage-state.json"
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, "playwright-cli", [
      "-s=pagecaster",
      "state-save",
      "auth/storage-state.json"
    ]);
  });

  it("runs goto through the named session", async () => {
    const runner = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const cli = new PlaywrightCli(config, runner);

    await cli.goto();

    expect(runner).toHaveBeenCalledWith("playwright-cli", [
      "-s=pagecaster",
      "goto",
      "https://read.amazon.co.jp/"
    ]);
  });

  it("runs code snippets through the named session", async () => {
    const runner = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const cli = new PlaywrightCli(config, runner);

    await cli.runCode("async ({ page }) => page.keyboard.press('ArrowRight')");

    expect(runner).toHaveBeenCalledWith("playwright-cli", [
      "-s=pagecaster",
      "run-code",
      "async ({ page }) => page.keyboard.press('ArrowRight')"
    ]);
  });

  it("runs tab commands through the named session", async () => {
    const runner = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const cli = new PlaywrightCli(config, runner);

    await cli.tabList();
    await cli.tabSelect(1);

    expect(runner).toHaveBeenNthCalledWith(1, "playwright-cli", [
      "-s=pagecaster",
      "tab-list"
    ]);
    expect(runner).toHaveBeenNthCalledWith(2, "playwright-cli", [
      "-s=pagecaster",
      "tab-select",
      "1"
    ]);
  });
});
