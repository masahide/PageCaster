import { describe, expect, it } from "vitest";
import { parsePageCount, parseTurnMode } from "../../src/cli/options.js";

describe("parsePageCount", () => {
  it("accepts a positive integer", () => {
    expect(parsePageCount("3")).toBe(3);
  });

  it("rejects zero", () => {
    expect(() => parsePageCount("0")).toThrow(/positive integer/);
  });

  it("rejects decimal values", () => {
    expect(() => parsePageCount("1.5")).toThrow(/positive integer/);
  });
});

describe("parseTurnMode", () => {
  it("accepts auto and manual", () => {
    expect(parseTurnMode("auto")).toBe("auto");
    expect(parseTurnMode("manual")).toBe("manual");
  });

  it("rejects invalid values", () => {
    expect(() => parseTurnMode("click")).toThrow(/turn-mode/);
  });
});
