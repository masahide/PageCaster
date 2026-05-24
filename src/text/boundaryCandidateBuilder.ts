import type {
  BoundaryCandidate,
  BoundaryCandidateKind,
  DocumentStream
} from "../types.js";
import { flattenDocumentStream, pageIndexAtOffset } from "./documentStreamText.js";

export class BoundaryCandidateBuilder {
  build(stream: DocumentStream): BoundaryCandidate[] {
    const document = flattenDocumentStream(stream);
    const boundaries = new Map<string, BoundaryCandidate>();

    for (let index = 0; index < document.text.length; index += 1) {
      const char = document.text[index];
      const offset = index + 1;

      if (/[。！？!?」』）\)]/u.test(char)) {
        addBoundary(boundaries, document.text, offset, "sentence_end");
      }

      if (/[、，,]/u.test(char)) {
        addBoundary(boundaries, document.text, offset, "comma");
      }

      if (char === "\n") {
        addBoundary(boundaries, document.text, offset, "paragraph");
      }
    }

    let offset = 0;
    for (const segment of stream.segments) {
      offset += segment.text.length;
      if (segment.kind === "page_break" && segment.text) {
        addBoundary(boundaries, document.text, offset, "page_break", segment.pageIndex);
      }
    }

    return Array.from(boundaries.values())
      .sort((a, b) => a.offset - b.offset || b.strength - a.strength)
      .map((boundary, index) => ({
        ...boundary,
        id: `b${String(index + 1).padStart(4, "0")}`,
        pageIndex:
          boundary.kind === "page_break"
            ? boundary.pageIndex
            : pageIndexAtOffset(document.offsets, boundary.offset)
      }));
  }
}

function addBoundary(
  boundaries: Map<string, BoundaryCandidate>,
  text: string,
  offset: number,
  kind: BoundaryCandidateKind,
  pageIndex?: number
): void {
  const key = `${offset}:${kind}`;
  boundaries.set(key, {
    id: "",
    offset,
    pageIndex: pageIndex ?? 1,
    kind,
    strength: strengthFor(kind),
    beforePreview: text.slice(Math.max(0, offset - 24), offset),
    afterPreview: text.slice(offset, offset + 24)
  });
}

function strengthFor(kind: BoundaryCandidateKind): number {
  switch (kind) {
    case "paragraph":
      return 90;
    case "sentence_end":
      return 80;
    case "page_break":
      return 70;
    case "comma":
      return 40;
    case "hard":
      return 10;
  }
}
