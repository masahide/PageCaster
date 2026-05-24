import { describe, expect, it } from "vitest";
import { TextChunker } from "../../src/text/textChunker.js";

describe("TextChunker", () => {
  it("creates chunks under max length", () => {
    const chunks = new TextChunker(12, 4).chunk(
      "吾輩は猫である。名前はまだない。どこで生れたか。",
      1
    );

    expect(chunks.every((chunk) => chunk.charLength <= 12)).toBe(true);
    expect(chunks[0].id).toBe("p000001-c001");
  });

  it("hard-splits text without sentence boundaries", () => {
    const chunks = new TextChunker(5, 1).chunk("あいうえおかきくけこ", 2);

    expect(chunks.map((chunk) => chunk.text)).toEqual(["あいうえお", "かきくけこ"]);
  });
});
