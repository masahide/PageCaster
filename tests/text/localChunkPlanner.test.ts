import { describe, expect, it } from "vitest";
import { BoundaryCandidateBuilder } from "../../src/text/boundaryCandidateBuilder.js";
import { LocalChunkPlanner } from "../../src/text/localChunkPlanner.js";
import type { DocumentStream } from "../../src/types.js";

describe("LocalChunkPlanner", () => {
  it("prefers sentence end boundaries for chunks", () => {
    const chunks = plan("短い文。次の文。最後。", 4, 1);

    expect(chunks.map((chunk) => chunk.text)).toEqual(["短い文。", "次の文。", "最後。"]);
    expect(chunks.every((chunk) => chunk.splitReason === "local")).toBe(true);
  });

  it("always respects TEXT_CHUNK_MAX_CHARS", () => {
    const chunks = plan("あいうえお。かきくけこ。さしすせそ。", 6, 1);

    expect(chunks.every((chunk) => chunk.charLength <= 6)).toBe(true);
  });

  it("splits long sentences at comma boundaries", () => {
    const chunks = plan("あいうえお、かきくけこ、さしすせそ。", 6, 1);

    expect(chunks.map((chunk) => chunk.text)).toEqual([
      "あいうえお、",
      "かきくけこ、",
      "さしすせそ。"
    ]);
  });

  it("hard splits when no boundary can keep the max length", () => {
    const chunks = plan("あいうえおかきくけこ", 5, 1);

    expect(chunks.map((chunk) => chunk.text)).toEqual(["あいうえお", "かきくけこ"]);
    expect(chunks[0].splitReason).toBe("hard");
  });
});

function plan(text: string, maxChars: number, minChars: number) {
  const stream: DocumentStream = {
    runId: "run-1",
    skippedPages: [],
    segments: [{ id: "p000001-t", pageIndex: 1, kind: "text", text }]
  };
  const boundaries = new BoundaryCandidateBuilder().build(stream);
  return new LocalChunkPlanner(maxChars, minChars).plan(stream, boundaries);
}
