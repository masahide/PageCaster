import { describe, expect, it, vi } from "vitest";
import { LlmBoundarySelector, parseSplitIds } from "../../src/text/llmBoundarySelector.js";
import type { BoundaryCandidate, TextPrepConfig } from "../../src/types.js";

const config: TextPrepConfig = {
  llmEnabled: true,
  llmProvider: "lmstudio",
  llmBaseUrl: "http://127.0.0.1:1234/v1",
  llmModel: "local-model",
  llmTimeoutMs: 60000,
  llmCorrectionMode: "edits",
  llmMaxEditRatio: 0.25,
  llmMaxTokens: 5000,
  llmMaxFixesPerChunk: 5,
  llmMaxAnchorChars: 40,
  llmMaxFixRatio: 0.25,
  llmDebugSaveResponses: true,
  textChunkMaxChars: 240,
  textChunkMinChars: 40,
  textSplitMode: "llm",
  textEnableLlmBoundary: true,
  textPageBreakJoin: true
};

const boundaries: BoundaryCandidate[] = [
  boundary("b0001", "sentence_end"),
  boundary("b0002", "comma")
];

describe("LlmBoundarySelector", () => {
  it("parses a single split tag", () => {
    expect(parseSplitIds('<split id="b0001"/>', new Set(["b0001"]))).toEqual([
      "b0001"
    ]);
  });

  it("parses multiple split tags", () => {
    expect(
      parseSplitIds('<split id="b0001"/>\n<split id="b0002"/>', new Set(["b0001", "b0002"]))
    ).toEqual(["b0001", "b0002"]);
  });

  it("rejects unknown boundary ids", () => {
    expect(() => parseSplitIds('<split id="missing"/>', new Set(["b0001"]))).toThrow(
      /LLM_RESPONSE_INVALID/
    );
  });

  it("rejects responses with body text or explanations", () => {
    expect(() =>
      parseSplitIds('ここで分割します。\n<split id="b0001"/>', new Set(["b0001"]))
    ).toThrow(/LLM_RESPONSE_INVALID/);
  });

  it("requests only boundary ids from LM Studio", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '<split id="b0001"/>' } }]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const selected = await new LlmBoundarySelector(config, fetchImpl).select({
      context: "短い文。次の文。",
      boundaries
    });

    expect(selected).toEqual(["b0001"]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:1234/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Return only split tags")
      })
    );
  });
});

function boundary(id: string, kind: BoundaryCandidate["kind"]): BoundaryCandidate {
  return {
    id,
    offset: 1,
    pageIndex: 1,
    kind,
    strength: 80,
    beforePreview: "before",
    afterPreview: "after"
  };
}
