import { describe, expect, it } from "vitest";
import { validatePrepareTextOptions } from "../../src/text/prepareTextOptions.js";

describe("validatePrepareTextOptions", () => {
  it("requires ocr-run-id or ocr-json", () => {
    expect(() => validatePrepareTextOptions({})).toThrow(
      /--ocr-run-id or --ocr-json/
    );
  });

  it("rejects both inputs together", () => {
    expect(() =>
      validatePrepareTextOptions({ ocrRunId: "run", ocrJson: "page.json" })
    ).toThrow(/either --ocr-run-id or --ocr-json/);
  });
});
