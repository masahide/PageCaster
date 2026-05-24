import type { DocumentStream } from "../types.js";
import { isTableOfContentsText } from "./tocDetector.js";

export type DocumentAssemblerPage = {
  index: number;
  text: string;
};

export type DocumentAssemblerInput = {
  runId: string;
  pages: DocumentAssemblerPage[];
  excludeToc?: boolean;
};

export class DocumentAssembler {
  assemble(input: DocumentAssemblerInput): DocumentStream {
    const includedPages: DocumentAssemblerPage[] = [];
    const skippedPages: DocumentStream["skippedPages"] = [];

    for (const page of input.pages) {
      const text = page.text.trim();
      if (!text) {
        skippedPages.push({ pageIndex: page.index, reason: "EMPTY" });
        continue;
      }

      if (input.excludeToc && isTableOfContentsText(text)) {
        skippedPages.push({ pageIndex: page.index, reason: "TOC" });
        continue;
      }

      includedPages.push({ ...page, text });
    }

    return {
      runId: input.runId,
      skippedPages,
      segments: includedPages.flatMap((page, index) => {
        const textSegment = {
          id: `p${String(page.index).padStart(6, "0")}-t`,
          pageIndex: page.index,
          kind: "text" as const,
          text: page.text
        };
        const nextPage = includedPages[index + 1];

        if (!nextPage) {
          return [textSegment];
        }

        return [
          textSegment,
          {
            id: `pb-p${String(page.index).padStart(6, "0")}-p${String(nextPage.index).padStart(6, "0")}`,
            pageIndex: page.index,
            kind: "page_break" as const,
            text: "\n"
          }
        ];
      })
    };
  }
}
