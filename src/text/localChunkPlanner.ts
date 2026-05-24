import type { BoundaryCandidate, DocumentStream, TextChunk } from "../types.js";
import {
  flattenDocumentStream,
  pageIndexAtOffset,
  type DocumentOffsetPage
} from "./documentStreamText.js";

export class LocalChunkPlanner {
  constructor(
    private readonly maxChars: number,
    private readonly minChars: number
  ) {}

  plan(stream: DocumentStream, boundaries: BoundaryCandidate[]): TextChunk[] {
    const document = flattenDocumentStream(stream);
    const chunks: TextChunk[] = [];
    let start = 0;
    let previousBoundaryId: string | undefined;

    while (start < document.text.length) {
      while (document.text[start] === "\n") {
        start += 1;
      }
      if (start >= document.text.length) {
        break;
      }

      const selected = this.selectBoundary(start, document.text.length, boundaries);
      const end = selected?.offset ?? Math.min(start + this.maxChars, document.text.length);
      const rawText = document.text.slice(start, end);
      const text = rawText.replace(/\n+/g, "").trim();

      if (text) {
        const pageIndex = pageIndexAtOffset(document.offsets, start + 1);
        chunks.push({
          id: `p${String(pageIndex).padStart(6, "0")}-c${String(chunks.length + 1).padStart(3, "0")}`,
          pageIndex,
          order: chunks.length + 1,
          text,
          charLength: text.length,
          sourcePageIndexes: sourcePageIndexes(document.offsets, start, end),
          boundaryStartId: previousBoundaryId,
          boundaryEndId: selected?.id,
          splitReason: selected?.kind === "hard" ? "hard" : "local"
        });
      }

      previousBoundaryId = selected?.id;
      start = end;
    }

    return chunks;
  }

  private selectBoundary(
    start: number,
    textLength: number,
    boundaries: BoundaryCandidate[]
  ): BoundaryCandidate | undefined {
    const hardEnd = Math.min(start + this.maxChars, textLength);
    const available = boundaries.filter(
      (boundary) => boundary.offset > start && boundary.offset <= hardEnd
    );

    const natural = available
      .filter((boundary) => boundary.offset - start >= this.minChars)
      .sort(
        (a, b) =>
          b.strength - a.strength ||
          b.offset - a.offset
      )[0];

    if (natural) {
      return natural;
    }

    if (hardEnd >= textLength) {
      return {
        id: "end",
        offset: textLength,
        pageIndex: 1,
        kind: "sentence_end",
        strength: 100,
        beforePreview: "",
        afterPreview: ""
      };
    }

    const fallback = available.sort((a, b) => b.offset - a.offset)[0];
    if (fallback) {
      return fallback;
    }

    return {
      id: `hard-${hardEnd}`,
      offset: hardEnd,
      pageIndex: 1,
      kind: "hard",
      strength: 10,
      beforePreview: "",
      afterPreview: ""
    };
  }
}

function sourcePageIndexes(
  offsets: DocumentOffsetPage[],
  start: number,
  end: number
): number[] {
  return Array.from(
    new Set(
      offsets
        .filter((range) => range.end > start && range.start < end)
        .map((range) => range.pageIndex)
    )
  );
}
