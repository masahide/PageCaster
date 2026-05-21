import { describe, expect, it } from "vitest";
import { loadEnvConfig } from "../../src/config/env.js";

describe("loadEnvConfig", () => {
  it("applies defaults for optional values", () => {
    const config = loadEnvConfig({
      KINDLE_URL: "https://read.amazon.co.jp/"
    });

    expect(config).toEqual({
      kindleUrl: "https://read.amazon.co.jp/",
      headless: false,
      browserChannel: undefined,
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
    });
  });

  it("rejects a clip outside the viewport", () => {
    expect(() =>
      loadEnvConfig({
        KINDLE_URL: "https://read.amazon.co.jp/",
        VIEWPORT_WIDTH: "100",
        VIEWPORT_HEIGHT: "100",
        CAPTURE_CLIP_X: "50",
        CAPTURE_CLIP_Y: "50",
        CAPTURE_CLIP_WIDTH: "80",
        CAPTURE_CLIP_HEIGHT: "80"
      })
    ).toThrow(/CAPTURE_CLIP/);
  });

  it("rejects invalid urls", () => {
    expect(() => loadEnvConfig({ KINDLE_URL: "not-a-url" })).toThrow(
      /KINDLE_URL/
    );
  });

  it("accepts a browser channel", () => {
    const config = loadEnvConfig({
      KINDLE_URL: "https://read.amazon.co.jp/",
      BROWSER_CHANNEL: "chrome"
    });

    expect(config.browserChannel).toBe("chrome");
  });
});
