import type { DocumentSegment, DocumentStream } from "../types.js";

export class PageBreakJoiner {
  join(stream: DocumentStream): DocumentStream {
    return {
      ...stream,
      segments: stream.segments.map((segment, index) => {
        if (segment.kind !== "page_break") {
          return segment;
        }

        const previous = findTextSegment(stream.segments, index, -1);
        const next = findTextSegment(stream.segments, index, 1);
        if (!previous || !next || !shouldJoin(previous.text, next.text)) {
          return segment;
        }

        return {
          ...segment,
          text: "",
          joined: true
        };
      })
    };
  }
}

function findTextSegment(
  segments: DocumentSegment[],
  startIndex: number,
  direction: -1 | 1
): DocumentSegment | undefined {
  for (
    let index = startIndex + direction;
    index >= 0 && index < segments.length;
    index += direction
  ) {
    if (segments[index]?.kind === "text") {
      return segments[index];
    }
  }
  return undefined;
}

function shouldJoin(previousText: string, nextText: string): boolean {
  const previous = previousText.trimEnd();
  const next = nextText.trimStart();
  if (!previous || !next) {
    return false;
  }

  if (/[。！？!?」』）\)]$/u.test(previous)) {
    return false;
  }

  if (/^(第[0-9０-９一二三四五六七八九十百千万]+[章節部]|CHAPTER\b|Chapter\b|\d+[.．、])/u.test(next)) {
    return false;
  }

  return true;
}
