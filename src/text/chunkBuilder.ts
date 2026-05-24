import type {
  BoundaryCandidate,
  DocumentStream,
  TextChunk
} from "../types.js";
import {
  flattenDocumentStream,
  pageIndexAtOffset,
  type DocumentOffsetPage
} from "./documentStreamText.js";

export class ChunkBuilder {
  build(
    stream: DocumentStream,
    boundaries: BoundaryCandidate[],
    selectedBoundaryIds: string[],
    splitReason: "local" | "llm" | "hard"
  ): TextChunk[] {
    const document = flattenDocumentStream(stream);
    const boundaryById = new Map(boundaries.map((boundary) => [boundary.id, boundary]));
    const selected = selectedBoundaryIds
      .map((id) => boundaryById.get(id))
      .filter((boundary): boundary is BoundaryCandidate => Boolean(boundary))
      .sort((a, b) => a.offset - b.offset);
    const offsets = [...selected.map((boundary) => boundary.offset), document.text.length];
    const chunks: TextChunk[] = [];
    let start = 0;
    let previousBoundaryId: string | undefined;

    for (const end of offsets) {
      if (end <= start) {
        continue;
      }

      const selectedBoundary = selected.find((boundary) => boundary.offset === end);
      const text = document.text.slice(start, end).replace(/\n+/g, "").trim();
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
          boundaryEndId: selectedBoundary?.id,
          splitReason
        });
      }

      previousBoundaryId = selectedBoundary?.id;
      start = end;
    }

    return chunks;
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
