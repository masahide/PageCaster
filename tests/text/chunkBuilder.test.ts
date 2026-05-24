import { describe, expect, it } from "vitest";
import { BoundaryCandidateBuilder } from "../../src/text/boundaryCandidateBuilder.js";
import { ChunkBuilder } from "../../src/text/chunkBuilder.js";
import type { DocumentStream } from "../../src/types.js";

describe("ChunkBuilder", () => {
  it("builds chunks from selected boundary ids", () => {
    const stream = streamOf("最初の文。次の文。");
    const boundaries = new BoundaryCandidateBuilder().build(stream);
    const chunks = new ChunkBuilder().build(stream, boundaries, ["b0001"], "llm");

    expect(chunks.map((chunk) => chunk.text)).toEqual(["最初の文。", "次の文。"]);
    expect(chunks[0]).toMatchObject({
      boundaryEndId: "b0001",
      splitReason: "llm"
    });
  });

  it("keeps source page indexes", () => {
    const stream: DocumentStream = {
      runId: "run-1",
      skippedPages: [],
      segments: [
        { id: "p000001-t", pageIndex: 1, kind: "text", text: "県大" },
        { id: "pb-p000001-p000002", pageIndex: 1, kind: "page_break", text: "", joined: true },
        { id: "p000002-t", pageIndex: 2, kind: "text", text: "会で優勝。" }
      ]
    };
    const boundaries = new BoundaryCandidateBuilder().build(stream);
    const chunks = new ChunkBuilder().build(stream, boundaries, [], "local");

    expect(chunks[0]).toMatchObject({
      text: "県大会で優勝。",
      sourcePageIndexes: [1, 2]
    });
  });
});

function streamOf(text: string): DocumentStream {
  return {
    runId: "run-1",
    skippedPages: [],
    segments: [{ id: "p000001-t", pageIndex: 1, kind: "text", text }]
  };
}
