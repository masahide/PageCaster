import { describe, expect, it } from "vitest";
import {
  parsePageFilter,
  validateOcrCliOptions
} from "../../src/cli/ocrOptions.js";

describe("validateOcrCliOptions", () => {
  it("requires run-id or image", () => {
    expect(() => validateOcrCliOptions({})).toThrow(/--run-id or --image/);
  });

  it("rejects run-id and image together", () => {
    expect(() =>
      validateOcrCliOptions({ runId: "run", image: "page.png" })
    ).toThrow(/either --run-id or --image/);
  });
});

describe("parsePageFilter", () => {
  it("parses single pages, ranges, and lists", () => {
    expect([...parsePageFilter("1,3-5")!]).toEqual([1, 3, 4, 5]);
  });

  it("rejects invalid ranges", () => {
    expect(() => parsePageFilter("5-3")).toThrow(/range start/);
  });
});
