import { describe, expect, it, vi } from "vitest";
import { LmStudioClient } from "../../src/text/lmStudioClient.js";
import type { TextPrepConfig } from "../../src/types.js";

const config: TextPrepConfig = {
  llmEnabled: true,
  llmProvider: "lmstudio",
  llmBaseUrl: "http://192.168.10.37:1234/v1",
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
  textSplitMode: "local",
  textEnableLlmBoundary: false,
  textPageBreakJoin: true
};

describe("LmStudioClient", () => {
  it("builds chat requests for OCR correction", () => {
    const request = new LmStudioClient(config).buildChatRequest("OCR text");

    expect(request).toMatchObject({
      model: "local-model",
      temperature: 0,
      stream: false
    });
    expect(request.messages[0].content).toContain("省略");
    expect(request.messages[0].content).toContain("推測補完");
    expect(request.messages[1].content).toContain("<ocr_text>\nOCR text\n</ocr_text>");
  });

  it("parses chat completion responses", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model: "model-a",
          choices: [{ message: { content: "補正済み本文" } }]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const result = await new LmStudioClient(config, fetchImpl).correctText("raw");

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://192.168.10.37:1234/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
    expect(result).toEqual({ text: "補正済み本文", model: "model-a" });
  });

  it("throws on invalid responses", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [] }), { status: 200 })
    ) as typeof fetch;

    await expect(new LmStudioClient(config, fetchImpl).correctText("raw")).rejects.toThrow(
      /message content/
    );
  });

  it("throws when responses contain omission markers", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "本文。（以下略）" } }]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    await expect(new LmStudioClient(config, fetchImpl).correctText("raw")).rejects.toThrow(
      /omission/
    );
  });
});
