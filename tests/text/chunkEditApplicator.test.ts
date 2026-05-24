import { describe, expect, it } from "vitest";
import { ChunkEditApplicator } from "../../src/text/chunkEditApplicator.js";

describe("ChunkEditApplicator", () => {
  it("applies accepted edits", () => {
    const result = new ChunkEditApplicator(50).apply("メツセージとプログ。", [
      { from: "メツセージ", to: "メッセージ" },
      { from: "プログ", to: "ブログ" }
    ]);

    expect(result).toEqual({
      text: "メッセージとブログ。",
      applied: true
    });
  });

  it("replaces only the first matching from text", () => {
    const result = new ChunkEditApplicator(50).apply("プログとプログ。", [
      { from: "プログ", to: "ブログ" }
    ]);

    expect(result.text).toBe("ブログとプログ。");
  });

  it("falls back when applying edits would exceed the chunk limit", () => {
    const result = new ChunkEditApplicator(5).apply("abc", [
      { from: "abc", to: "abcdef" }
    ]);

    expect(result).toEqual({
      text: "abc",
      applied: false,
      fallbackReason: "TOO_LONG_AFTER_EDIT"
    });
  });
});
