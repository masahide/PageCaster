import { describe, expect, it, vi } from "vitest";
import { LmStudioEditClient } from "../../src/text/lmStudioEditClient.js";
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

describe("LmStudioEditClient", () => {
  it("builds edit-only chat requests", () => {
    const request = new LmStudioEditClient(config).buildChatRequest({
      id: "p000001-c001",
      text: "OCR text"
    });

    expect(request).toMatchObject({
      model: "local-model",
      temperature: 0,
      stream: false,
      max_tokens: 512
    });
    expect(request.messages[0].content).toContain("本文全文を返してはいけません");
    expect(request.messages[1].content).toContain('<chunk id="p000001-c001">');
    expect(request.messages[1].content).toContain('"edits"');
  });

  it("parses empty edit responses", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"edits":[]}' } }]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const edits = await new LmStudioEditClient(config, fetchImpl).proposeEdits({
      id: "p000001-c001",
      text: "本文"
    });

    expect(edits).toEqual([]);
  });

  it("parses multiple edits", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"edits":[{"from":"メツセ","to":"メッセ"},{"from":"プログ","to":"ブログ","reason":"OCR"}]}'
              }
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const edits = await new LmStudioEditClient(config, fetchImpl).proposeEdits({
      id: "p000001-c001",
      text: "本文"
    });

    expect(edits).toEqual([
      { from: "メツセ", to: "メッセ" },
      { from: "プログ", to: "ブログ", reason: "OCR" }
    ]);
  });

  it("parses JSON inside code fences", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '```json\n{"edits":[{"from":"プログ","to":"ブログ"}]}\n```'
              }
            }
          ]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const edits = await new LmStudioEditClient(config, fetchImpl).proposeEdits({
      id: "p000001-c001",
      text: "本文"
    });

    expect(edits).toEqual([{ from: "プログ", to: "ブログ" }]);
  });

  it("throws invalid response errors for broken JSON", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "補正済み本文" } }]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    await expect(
      new LmStudioEditClient(config, fetchImpl).proposeEdits({
        id: "p000001-c001",
        text: "本文"
      })
    ).rejects.toThrow(/LLM_RESPONSE_INVALID/);
  });

  it("throws invalid response errors for schema mismatches", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"text":"補正済み本文"}' } }]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    await expect(
      new LmStudioEditClient(config, fetchImpl).proposeEdits({
        id: "p000001-c001",
        text: "本文"
      })
    ).rejects.toThrow(/LLM_RESPONSE_INVALID/);
  });
});
