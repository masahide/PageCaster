import { describe, expect, it } from "vitest";
import { BoundaryCandidateBuilder } from "../../src/text/boundaryCandidateBuilder.js";
import type { DocumentStream } from "../../src/types.js";

describe("BoundaryCandidateBuilder", () => {
  it("creates sentence end boundary candidates", () => {
    const boundaries = new BoundaryCandidateBuilder().build(streamOf("本文です。次です！"));

    expect(boundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ offset: 5, kind: "sentence_end", pageIndex: 1 }),
        expect.objectContaining({ offset: 9, kind: "sentence_end", pageIndex: 1 })
      ])
    );
  });

  it("creates paragraph boundary candidates", () => {
    const boundaries = new BoundaryCandidateBuilder().build(streamOf("一段落。\n二段落。"));

    expect(boundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ offset: 5, kind: "paragraph", pageIndex: 1 })
      ])
    );
  });

  it("creates comma boundary candidates", () => {
    const boundaries = new BoundaryCandidateBuilder().build(streamOf("長い文で、途中で切れる。"));

    expect(boundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ offset: 5, kind: "comma", pageIndex: 1 })
      ])
    );
  });

  it("creates page break boundary candidates", () => {
    const boundaries = new BoundaryCandidateBuilder().build({
      runId: "run-1",
      skippedPages: [],
      segments: [
        { id: "p000001-t", pageIndex: 1, kind: "text", text: "前の文。" },
        { id: "pb-p000001-p000002", pageIndex: 1, kind: "page_break", text: "\n" },
        { id: "p000002-t", pageIndex: 2, kind: "text", text: "次の文。" }
      ]
    });

    expect(boundaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ offset: 5, kind: "page_break", pageIndex: 1 })
      ])
    );
  });

  it("assigns stronger scores to sentence and paragraph boundaries", () => {
    const boundaries = new BoundaryCandidateBuilder().build(streamOf("文です。\n長く、続く。"));
    const sentence = boundaries.find((boundary) => boundary.kind === "sentence_end");
    const comma = boundaries.find((boundary) => boundary.kind === "comma");

    expect(sentence?.strength).toBeGreaterThan(comma?.strength ?? 0);
  });
});

function streamOf(text: string): DocumentStream {
  return {
    runId: "run-1",
    skippedPages: [],
    segments: [{ id: "p000001-t", pageIndex: 1, kind: "text", text }]
  };
}
