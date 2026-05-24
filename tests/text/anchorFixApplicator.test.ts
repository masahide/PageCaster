import { describe, expect, it } from "vitest";
import { AnchorFixApplicator } from "../../src/text/anchorFixApplicator.js";

describe("AnchorFixApplicator", () => {
  it("replaces only the target inside the anchor", () => {
    const result = new AnchorFixApplicator(50).apply("メツセは前。広報担当者から来たメツセを読む。", [
      { anchor: "広報担当者から来たメツセ", target: "メツセ", to: "メッセ" }
    ]);

    expect(result).toEqual({
      text: "メツセは前。広報担当者から来たメッセを読む。",
      applied: true
    });
  });

  it("does not replace the same target outside the anchor", () => {
    const result = new AnchorFixApplicator(50).apply("プログを閉じて、仕事のプログを書く。", [
      { anchor: "仕事のプログ", target: "プログ", to: "ブログ" }
    ]);

    expect(result.text).toBe("プログを閉じて、仕事のブログを書く。");
  });

  it("applies multiple fixes in order", () => {
    const result = new AnchorFixApplicator(80).apply("フエイスブツクとネツトを使う。", [
      { anchor: "フエイスブツクと", target: "フエイスブツク", to: "フェイスブック" },
      { anchor: "ネツトを使う", target: "ネツト", to: "ネット" }
    ]);

    expect(result.text).toBe("フェイスブックとネットを使う。");
  });

  it("falls back when the result exceeds the max length", () => {
    const result = new AnchorFixApplicator(5).apply("abc", [
      { anchor: "abc", target: "b", to: "長い置換" }
    ]);

    expect(result).toEqual({
      text: "abc",
      applied: false,
      fallbackReason: "TOO_LONG_AFTER_FIX"
    });
  });
});
