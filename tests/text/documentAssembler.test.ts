import { describe, expect, it } from "vitest";
import { DocumentAssembler } from "../../src/text/documentAssembler.js";

describe("DocumentAssembler", () => {
  it("assembles multiple pages in document order", () => {
    const stream = new DocumentAssembler().assemble({
      runId: "run-1",
      pages: [
        { index: 2, text: "二ページ目" },
        { index: 3, text: "三ページ目" }
      ]
    });

    expect(stream.segments).toEqual([
      { id: "p000002-t", pageIndex: 2, kind: "text", text: "二ページ目" },
      { id: "pb-p000002-p000003", pageIndex: 2, kind: "page_break", text: "\n" },
      { id: "p000003-t", pageIndex: 3, kind: "text", text: "三ページ目" }
    ]);
    expect(stream.skippedPages).toEqual([]);
  });

  it("records table of contents pages as skipped pages", () => {
    const stream = new DocumentAssembler().assemble({
      runId: "run-1",
      excludeToc: true,
      pages: [
        {
          index: 4,
          text: "目次\nCHAPTER1 はじめに\nEYE ひとつめ\nCHAPTER2 次へ\nEYE ふたつめ"
        },
        { index: 5, text: "本文です。" }
      ]
    });

    expect(stream.skippedPages).toEqual([{ pageIndex: 4, reason: "TOC" }]);
    expect(stream.segments).toEqual([
      { id: "p000005-t", pageIndex: 5, kind: "text", text: "本文です。" }
    ]);
  });

  it("keeps page index metadata on every text segment", () => {
    const stream = new DocumentAssembler().assemble({
      runId: "run-1",
      pages: [
        { index: 10, text: "十ページ目" },
        { index: 11, text: "十一ページ目" }
      ]
    });

    expect(stream.segments.filter((segment) => segment.kind === "text")).toEqual([
      expect.objectContaining({ id: "p000010-t", pageIndex: 10 }),
      expect.objectContaining({ id: "p000011-t", pageIndex: 11 })
    ]);
  });
});
