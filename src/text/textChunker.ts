import type { TextChunk } from "../types.js";

export class TextChunker {
  constructor(
    private readonly maxChars: number,
    private readonly minChars: number
  ) {}

  chunk(text: string, pageIndex: number): TextChunk[] {
    const sentences = splitSentences(text);
    const chunks: TextChunk[] = [];
    let current = "";

    for (const sentence of sentences) {
      if (!sentence) {
        continue;
      }

      if ((current + sentence).length <= this.maxChars) {
        current += sentence;
        continue;
      }

      if (current.length >= this.minChars) {
        chunks.push(this.createChunk(pageIndex, chunks.length + 1, current));
        current = sentence;
      } else {
        const hardSplit = splitByMaxChars(current + sentence, this.maxChars);
        for (const part of hardSplit.slice(0, -1)) {
          chunks.push(this.createChunk(pageIndex, chunks.length + 1, part));
        }
        current = hardSplit.at(-1) ?? "";
      }
    }

    if (current.trim()) {
      chunks.push(this.createChunk(pageIndex, chunks.length + 1, current));
    }

    return chunks;
  }

  private createChunk(pageIndex: number, order: number, text: string): TextChunk {
    const trimmed = text.trim();
    return {
      id: `p${String(pageIndex).padStart(6, "0")}-c${String(order).padStart(3, "0")}`,
      pageIndex,
      order,
      text: trimmed,
      charLength: trimmed.length
    };
  }
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, "")
    .split(/(?<=[。！？!?」』）\)])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function splitByMaxChars(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < text.length; offset += maxChars) {
    chunks.push(text.slice(offset, offset + maxChars));
  }
  return chunks;
}
