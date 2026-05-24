import type { DocumentStream } from "../types.js";

export type DocumentOffsetPage = {
  start: number;
  end: number;
  pageIndex: number;
};

export type DocumentText = {
  text: string;
  offsets: DocumentOffsetPage[];
};

export function flattenDocumentStream(stream: DocumentStream): DocumentText {
  let text = "";
  const offsets: DocumentOffsetPage[] = [];

  for (const segment of stream.segments) {
    const start = text.length;
    text += segment.text;
    const end = text.length;
    if (segment.kind === "text" && end > start) {
      offsets.push({ start, end, pageIndex: segment.pageIndex });
    }
  }

  return { text, offsets };
}

export function pageIndexAtOffset(
  offsets: DocumentOffsetPage[],
  offset: number
): number {
  return (
    offsets.find((range) => offset > range.start && offset <= range.end)
      ?.pageIndex ??
    offsets.find((range) => offset >= range.start && offset < range.end)
      ?.pageIndex ??
    offsets.at(-1)?.pageIndex ??
    1
  );
}
