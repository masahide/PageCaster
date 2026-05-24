import { describe, expect, it } from "vitest";
import { isTableOfContentsText } from "../../src/text/tocDetector.js";

describe("isTableOfContentsText", () => {
  it("detects table of contents pages", () => {
    expect(
      isTableOfContentsText(
        [
          "目次",
          "はじめに",
          "CHAPTER1 リスクを見極める眼",
          "EYE 腹を決めて勝負に出る",
          "EYE 麻雀界のカリスマからの教え",
          "CHAPTER2 Z世代を見極める眼",
          "EYE 若者を動かす炙りマネジメント"
        ].join("\n")
      )
    ).toBe(true);
  });

  it("does not treat prose that mentions table of contents as TOC", () => {
    expect(
      isTableOfContentsText(
        "この章では目次を眺めながら、当時の出来事を振り返る。本文はそのまま続いていく。"
      )
    ).toBe(false);
  });
});
