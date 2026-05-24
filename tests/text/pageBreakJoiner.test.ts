import { describe, expect, it } from "vitest";
import { PageBreakJoiner } from "../../src/text/pageBreakJoiner.js";
import type { DocumentStream } from "../../src/types.js";

describe("PageBreakJoiner", () => {
  it("joins page breaks in the middle of a sentence", () => {
    const stream = createStream("県大", "会で優勝した。");
    const joined = new PageBreakJoiner().join(stream);

    expect(toText(joined)).toBe("県大会で優勝した。");
    expect(joined.segments[1]).toMatchObject({
      kind: "page_break",
      text: "",
      joined: true
    });
  });

  it("keeps page breaks after sentence endings", () => {
    const stream = createStream("前の文。", "次の文。");
    const joined = new PageBreakJoiner().join(stream);

    expect(toText(joined)).toBe("前の文。\n次の文。");
    expect(joined.segments[1]).toMatchObject({ kind: "page_break", text: "\n" });
  });

  it("does not join before headings", () => {
    const stream = createStream("前段落", "第2章 新しい話");
    const joined = new PageBreakJoiner().join(stream);

    expect(toText(joined)).toBe("前段落\n第2章 新しい話");
  });

  it("keeps page break metadata after joining", () => {
    const stream = createStream("県大", "会で優勝した。");
    const joined = new PageBreakJoiner().join(stream);

    expect(joined.segments[1]).toMatchObject({
      id: "pb-p000001-p000002",
      pageIndex: 1,
      kind: "page_break",
      joined: true
    });
  });
});

function createStream(first: string, second: string): DocumentStream {
  return {
    runId: "run-1",
    skippedPages: [],
    segments: [
      { id: "p000001-t", pageIndex: 1, kind: "text", text: first },
      { id: "pb-p000001-p000002", pageIndex: 1, kind: "page_break", text: "\n" },
      { id: "p000002-t", pageIndex: 2, kind: "text", text: second }
    ]
  };
}

function toText(stream: DocumentStream): string {
  return stream.segments.map((segment) => segment.text).join("");
}
