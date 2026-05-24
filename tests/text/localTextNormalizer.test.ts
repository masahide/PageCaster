import { describe, expect, it } from "vitest";
import { LocalTextNormalizer } from "../../src/text/localTextNormalizer.js";

describe("LocalTextNormalizer", () => {
  it("removes page noise and normalizes whitespace", () => {
    const result = new LocalTextNormalizer().normalize(
      [
        "Kindle Library",
        "Page 2 of 28%",
        "Back to 20",
        "1 hrs 46 mins left in book",
        "1 minute left in chapter",
        "= Aa □ :",
        "14",
        "  吾輩　は  猫である。",
        "",
        "名前はまだない。"
      ].join("\n")
    );

    expect(result).toBe("吾輩 は 猫である。\n名前はまだない。");
  });
});
