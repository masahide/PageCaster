import { describe, expect, it, vi } from "vitest";
import { LmStudioAnchorFixClient } from "../../src/text/lmStudioAnchorFixClient.js";
import type { TextPrepConfig } from "../../src/types.js";

const config: TextPrepConfig = {
  llmEnabled: true,
  llmProvider: "lmstudio",
  llmBaseUrl: "http://192.168.10.37:1234/v1",
  llmModel: "local-model",
  llmTimeoutMs: 60000,
  llmCorrectionMode: "anchor",
  llmMaxEditRatio: 0.25,
  llmMaxTokens: 10000,
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

describe("LmStudioAnchorFixClient", () => {
  it("builds anchor fix prompt requests", () => {
    const request = new LmStudioAnchorFixClient(config).buildChatRequest({
      id: "p000001-c001",
      text: "広報担当者から来たメツセ"
    });

    expect(request).toMatchObject({
      model: "local-model",
      temperature: 0,
      stream: false,
      max_tokens: 10000
    });
    expect(request.messages[0].content).toContain("<anchor>");
    expect(request.messages[0].content).toContain("NO_FIX");
    expect(request.messages[0].content).toContain("本文全文を返してはいけません");
    expect(request.messages[0].content).toContain("考察しないでください");
    expect(request.messages[0].content).toContain("最大5件");
    expect(request.messages[0].content).toContain("例に出ている修正も");
    expect(request.messages[1].content).toContain('<chunk id="p000001-c001">');
    expect(request.messages[1].content).toContain("<target>メツセ</target>");
  });

  it("parses fake LM Studio responses", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "<fix><anchor>広報担当者から来たメツセ</anchor><target>メツセ</target><to>メッセ</to></fix>",
                reasoning_content: "メツセはメッセのOCR誤り候補です。"
              }
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
            completion_tokens_details: { reasoning_tokens: 8 }
          }
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const result = await new LmStudioAnchorFixClient(config, fetchImpl).proposeFixesWithTrace({
      id: "p000001-c001",
      text: "広報担当者から来たメツセ"
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://192.168.10.37:1234/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.fixes).toEqual([
      { anchor: "広報担当者から来たメツセ", target: "メツセ", to: "メッセ" }
    ]);
    expect(result.trace).toMatchObject({
      status: 200,
      ok: true,
      reasoningContent: "メツセはメッセのOCR誤り候補です。",
      promptTokens: 10,
      completionTokens: 20,
      reasoningTokens: 8,
      totalTokens: 30
    });
    expect(result.trace.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("preserves transport error cause details", async () => {
    const cause = Object.assign(new Error("socket closed"), {
      code: "UND_ERR_SOCKET",
      syscall: "read",
      address: "192.168.10.37",
      port: 1234
    });
    const fetchImpl = vi.fn(async () => {
      throw Object.assign(new TypeError("fetch failed"), { cause });
    }) as typeof fetch;

    await expect(
      new LmStudioAnchorFixClient(config, fetchImpl).proposeFixesWithTrace({
        id: "p000001-c001",
        text: "広報担当者から来たメツセ"
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining("UND_ERR_SOCKET"),
      trace: {
        transportError: {
          name: "TypeError",
          message: "fetch failed",
          cause: {
            message: "socket closed",
            code: "UND_ERR_SOCKET",
            syscall: "read",
            address: "192.168.10.37",
            port: 1234
          }
        }
      }
    });
  });
});
