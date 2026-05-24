import type { ChunkEdit } from "../types.js";

export type ChunkEditApplyResult = {
  text: string;
  applied: boolean;
  fallbackReason?: "TOO_LONG_AFTER_EDIT";
};

export class ChunkEditApplicator {
  constructor(private readonly maxChars: number) {}

  apply(chunkText: string, edits: ChunkEdit[]): ChunkEditApplyResult {
    let nextText = chunkText;

    for (const edit of edits) {
      nextText = replaceFirst(nextText, edit.from, edit.to);
    }

    if (nextText.length > this.maxChars) {
      return {
        text: chunkText,
        applied: false,
        fallbackReason: "TOO_LONG_AFTER_EDIT"
      };
    }

    return {
      text: nextText,
      applied: nextText !== chunkText
    };
  }
}

function replaceFirst(text: string, from: string, to: string): string {
  const index = text.indexOf(from);
  if (index < 0) {
    return text;
  }

  return `${text.slice(0, index)}${to}${text.slice(index + from.length)}`;
}
