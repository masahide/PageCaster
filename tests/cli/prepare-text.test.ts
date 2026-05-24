import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TextPrepConfig } from "../../src/types.js";

let tempDir: string;
let originalCwd: string;

const baseConfig: TextPrepConfig = {
  llmEnabled: false,
  llmProvider: "lmstudio",
  llmBaseUrl: "http://192.168.10.37:1234/v1",
  llmTimeoutMs: 60000,
  llmCorrectionMode: "anchor",
  llmMaxEditRatio: 0.25,
  llmMaxTokens: 5000,
  llmMaxFixesPerChunk: 5,
  llmMaxAnchorChars: 40,
  llmMaxFixRatio: 0.25,
  llmDebugSaveResponses: true,
  textChunkMaxChars: 6,
  textChunkMinChars: 5,
  textSplitMode: "local",
  textEnableLlmBoundary: false,
  textPageBreakJoin: true
};

describe("runPrepareText", () => {
  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pagecaster-prepare-text-"));
    process.chdir(tempDir);
    vi.resetModules();
    await createOcrRun();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("prepares chunks without LM Studio when LLM is disabled", async () => {
    const { runPrepareText } = await import("../../src/cli/prepare-text.js");
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await runPrepareText({ ocrRunId: "ocr-run-1" }, { config: baseConfig, fetchImpl });

    const chunks = JSON.parse(
      await fs.readFile(
        path.join(tempDir, "data", "text", "ocr-run-1", "chunks.json"),
        "utf8"
      )
    );
    const metadata = JSON.parse(
      await fs.readFile(
        path.join(tempDir, "data", "text", "ocr-run-1", "text-run.json"),
        "utf8"
      )
    );

    expect(chunks).toEqual([
      expect.objectContaining({ pageIndex: 1, text: "最初の文。" }),
      expect.objectContaining({ pageIndex: 1, text: "次の文。" })
    ]);
    expect(metadata.pages[0]).toMatchObject({
      index: 1,
      usedLlm: false
    });
    expect(chunks[0].correction).toMatchObject({ usedLlm: false });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(metadata.pages[0].rawTextLength).toBeGreaterThan(0);
    expect(metadata.boundarySelection).toMatchObject({ mode: "local" });
  });

  it("joins sentence continuations across page breaks in document-level flow", async () => {
    await createOcrRun([
      { index: 1, blocks: [{ text: "県大" }] },
      { index: 2, blocks: [{ text: "会で優勝した。" }] }
    ]);
    const { runPrepareText } = await import("../../src/cli/prepare-text.js");

    await runPrepareText(
      { ocrRunId: "ocr-run-1", ocrCorrection: false },
      { config: { ...baseConfig, textChunkMaxChars: 20 } }
    );

    const runDir = path.join(tempDir, "data", "text", "ocr-run-1");
    const chunks = JSON.parse(await fs.readFile(path.join(runDir, "chunks.json"), "utf8"));
    const metadata = JSON.parse(
      await fs.readFile(path.join(runDir, "text-run.json"), "utf8")
    );

    expect(chunks[0]).toMatchObject({
      text: "県大会で優勝した。",
      sourcePageIndexes: [1, 2]
    });
    expect(metadata.pageBreakJoinCount).toBe(1);
  });

  it("prepares a single OCR JSON input", async () => {
    const { runPrepareText } = await import("../../src/cli/prepare-text.js");

    await runPrepareText(
      {
        ocrJson: path.join(
          tempDir,
          "data",
          "ocr",
          "ocr-run-1",
          "page-000001",
          "page-000001.json"
        )
      },
      { config: baseConfig }
    );

    const textDir = path.join(tempDir, "data", "text");
    const runIds = await fs.readdir(textDir);
    expect(runIds[0]).toMatch(/^single-/);
    await expect(
      fs.readFile(path.join(textDir, runIds[0], "chunks.json"), "utf8")
    ).resolves.toContain("最初の文。");
  });

  it("skips table of contents pages when excludeToc is enabled", async () => {
    const tocJsonPath = path.join(
      tempDir,
      "data",
      "ocr",
      "ocr-run-1",
      "page-000001",
      "page-000001.json"
    );
    await fs.writeFile(
      tocJsonPath,
      JSON.stringify({
        blocks: [
          { text: "目次" },
          { text: "CHAPTER1 リスクを見極める眼" },
          { text: "EYE 腹を決めて勝負に出る" },
          { text: "EYE 麻雀界のカリスマからの教え" },
          { text: "CHAPTER2 Z世代を見極める眼" },
          { text: "EYE 若者を動かす炙りマネジメント" }
        ]
      }),
      "utf8"
    );
    const { runPrepareText } = await import("../../src/cli/prepare-text.js");
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await runPrepareText(
      { ocrRunId: "ocr-run-1", excludeToc: true },
      { config: { ...baseConfig, llmEnabled: true }, fetchImpl }
    );

    const runDir = path.join(tempDir, "data", "text", "ocr-run-1");
    const chunks = JSON.parse(await fs.readFile(path.join(runDir, "chunks.json"), "utf8"));
    const metadata = JSON.parse(
      await fs.readFile(path.join(runDir, "text-run.json"), "utf8")
    );

    expect(chunks).toEqual([]);
    expect(metadata.pages[0]).toMatchObject({
      index: 1,
      skipReason: "TOC",
      correctedTextLength: 0,
      usedLlm: false
    });
    expect(metadata.skippedPages).toEqual([{ pageIndex: 1, reason: "TOC" }]);
    await expect(
      fs.readFile(path.join(runDir, "page-000001.corrected.txt"), "utf8")
    ).resolves.toBe("");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("excludes TOC pages from document-level chunks", async () => {
    await createOcrRun([
      { index: 2, blocks: [{ text: "本文の文。" }] },
      {
        index: 4,
        blocks: [
          { text: "目次" },
          { text: "CHAPTER1 はじめに" },
          { text: "EYE ひとつめ" },
          { text: "CHAPTER2 次へ" },
          { text: "EYE ふたつめ" }
        ]
      }
    ]);
    const { runPrepareText } = await import("../../src/cli/prepare-text.js");

    await runPrepareText(
      { ocrRunId: "ocr-run-1", pages: "2-4", excludeToc: true, ocrCorrection: false },
      { config: { ...baseConfig, textChunkMaxChars: 20 } }
    );

    const runDir = path.join(tempDir, "data", "text", "ocr-run-1");
    const chunks = JSON.parse(await fs.readFile(path.join(runDir, "chunks.json"), "utf8"));
    const metadata = JSON.parse(
      await fs.readFile(path.join(runDir, "text-run.json"), "utf8")
    );

    expect(chunks).toEqual([
      expect.objectContaining({ pageIndex: 2, text: "本文の文。" })
    ]);
    expect(metadata.skippedPages).toEqual([{ pageIndex: 4, reason: "TOC" }]);
  });

  it("falls back to normalized text when LM Studio fails", async () => {
    const { runPrepareText } = await import("../../src/cli/prepare-text.js");
    const fetchImpl = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch;

    await runPrepareText(
      { ocrRunId: "ocr-run-1" },
      { config: { ...baseConfig, llmEnabled: true }, fetchImpl }
    );

    const metadata = JSON.parse(
      await fs.readFile(
        path.join(tempDir, "data", "text", "ocr-run-1", "text-run.json"),
        "utf8"
      )
    );

    expect(metadata.errors).toEqual([
      expect.objectContaining({
        code: "LLM_REQUEST_FAILED",
        pageIndex: 1,
        chunkId: "p000001-c001"
      }),
      expect.objectContaining({
        code: "LLM_REQUEST_FAILED",
        pageIndex: 1,
        chunkId: "p000001-c002"
      })
    ]);
    expect(metadata.llmCalls[0]).toMatchObject({
      chunkId: "p000001-c001",
      errorCode: "LLM_REQUEST_FAILED",
      transportError: {
        message: "connect ECONNREFUSED"
      }
    });
    expect(metadata.pages[0].usedLlm).toBe(false);
  });

  it("records invalid response errors when LM Studio returns omission markers", async () => {
    const { runPrepareText } = await import("../../src/cli/prepare-text.js");
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "本文。（以下略）" } }]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    await runPrepareText(
      { ocrRunId: "ocr-run-1" },
      { config: { ...baseConfig, llmEnabled: true }, fetchImpl }
    );

    const metadata = JSON.parse(
      await fs.readFile(
        path.join(tempDir, "data", "text", "ocr-run-1", "text-run.json"),
        "utf8"
      )
    );

    expect(metadata.errors).toEqual([
      expect.objectContaining({ code: "LLM_RESPONSE_INVALID", pageIndex: 1 }),
      expect.objectContaining({ code: "LLM_RESPONSE_INVALID", pageIndex: 1 })
    ]);
    expect(metadata.pages[0].usedLlm).toBe(false);
  });

  it("uses fake LM Studio anchor fix responses after local chunking", async () => {
    const server = http.createServer((request, response) => {
      expect(request.url).toBe("/v1/chat/completions");
      const body: Buffer[] = [];
      request.on("data", (chunk) => body.push(chunk));
      request.on("end", () => {
        const requestBody = Buffer.concat(body).toString("utf8");
        const content = requestBody.includes("p000001-c001")
          ? "<fix><anchor>最初の文</anchor><target>最初</target><to>最始</to></fix>"
          : "NO_FIX";
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            model: "fake-model",
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content,
                  reasoning_content: requestBody.includes("p000001-c001")
                    ? "最初を最始へ修正する候補です。"
                    : "修正不要です。"
                }
              }
            ],
            usage: {
              prompt_tokens: 11,
              completion_tokens: 22,
              total_tokens: 33,
              completion_tokens_details: { reasoning_tokens: 7 }
            }
          })
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Fake LM Studio server did not expose a port.");
    }

    try {
      const { runPrepareText } = await import("../../src/cli/prepare-text.js");

      await runPrepareText(
        { ocrRunId: "ocr-run-1" },
        {
          config: {
            ...baseConfig,
            llmEnabled: true,
            llmBaseUrl: `http://127.0.0.1:${address.port}/v1`
          }
        }
      );

      const runDir = path.join(tempDir, "data", "text", "ocr-run-1");
      await expect(
        fs.readFile(path.join(runDir, "page-000001.corrected.txt"), "utf8")
      ).resolves.toBe("最始の文。次の文。");
      const chunks = JSON.parse(
        await fs.readFile(path.join(runDir, "chunks.json"), "utf8")
      );
      expect(chunks[0]).toMatchObject({
        text: "最始の文。",
        correction: {
          usedLlm: true,
          acceptedEditCount: 1,
          rejectedEditCount: 0,
          mode: "anchor"
        }
      });
      expect(chunks[1]).toMatchObject({
        text: "次の文。",
        correction: {
          usedLlm: true,
          acceptedEditCount: 0,
          rejectedEditCount: 0,
          mode: "anchor"
        }
      });
      const metadata = JSON.parse(
        await fs.readFile(path.join(runDir, "text-run.json"), "utf8")
      );
      expect(metadata.pages[0]).toMatchObject({ usedLlm: true });
      expect(metadata.llmCalls).toEqual([
        expect.objectContaining({
          chunkId: "p000001-c001",
          pageIndex: 1,
          elapsedMs: expect.any(Number),
          status: 200,
          finishReason: "stop",
          model: "fake-model",
          reasoningTokens: 7,
          acceptedEditCount: 1,
          rejectedEditCount: 0,
          debugPath: expect.stringContaining("p000001-c001")
        }),
        expect.objectContaining({
          chunkId: "p000001-c002",
          acceptedEditCount: 0,
          rejectedEditCount: 0,
          debugPath: expect.stringContaining("p000001-c002")
        })
      ]);
      const debug = JSON.parse(
        await fs.readFile(metadata.llmCalls[0].debugPath, "utf8")
      );
      expect(debug.reasoningContent).toBe("最初を最始へ修正する候補です。");
      expect(debug.request.messages[1].content).toContain("最初の文。");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("rejects dangerous anchor fix candidates and keeps the local chunk", async () => {
    const { runPrepareText } = await import("../../src/cli/prepare-text.js");
    const fetchImpl = vi.fn(async (_url, init) => {
      const body = String(init?.body ?? "");
      const content = body.includes("p000001-c001")
        ? "<fix><anchor>最初の文</anchor><target>最初の文</target><to>最初の文。（以下略）</to></fix>"
        : "NO_FIX";
      return new Response(
        JSON.stringify({
          choices: [{ message: { content } }]
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    await runPrepareText(
      { ocrRunId: "ocr-run-1" },
      { config: { ...baseConfig, llmEnabled: true }, fetchImpl }
    );

    const runDir = path.join(tempDir, "data", "text", "ocr-run-1");
    const chunks = JSON.parse(await fs.readFile(path.join(runDir, "chunks.json"), "utf8"));
    const metadata = JSON.parse(
      await fs.readFile(path.join(runDir, "text-run.json"), "utf8")
    );

    expect(chunks[0]).toMatchObject({
      text: "最初の文。",
      correction: {
        usedLlm: true,
        acceptedEditCount: 0,
        rejectedEditCount: 1,
        fallbackReason: "LLM_EDIT_REJECTED",
        rejectReasons: ["ADDS_OMISSION_MARKER"]
      }
    });
    expect(metadata.errors).toEqual([
      expect.objectContaining({ code: "LLM_EDIT_REJECTED", pageIndex: 1 })
    ]);
  });

  it("falls back to local chunk planning when LLM boundary selection is invalid", async () => {
    const { runPrepareText } = await import("../../src/cli/prepare-text.js");
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "ここで分割します。" } }]
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    await runPrepareText(
      { ocrRunId: "ocr-run-1", ocrCorrection: false },
      {
        config: {
          ...baseConfig,
          llmEnabled: true,
          textSplitMode: "llm",
          textEnableLlmBoundary: true
        },
        fetchImpl
      }
    );

    const metadata = JSON.parse(
      await fs.readFile(
        path.join(tempDir, "data", "text", "ocr-run-1", "text-run.json"),
        "utf8"
      )
    );

    expect(metadata.boundarySelection).toMatchObject({
      mode: "local",
      fallbackReason: "LLM_RESPONSE_INVALID"
    });
    expect(metadata.errors).toEqual([
      expect.objectContaining({ code: "LLM_RESPONSE_INVALID" })
    ]);
  });
});

async function createOcrRun(
  pages = [{ index: 1, blocks: [{ text: "最初の文。" }, { text: "次の文。" }] }]
): Promise<void> {
  const metadataPages: Array<{ index: number; jsonPath: string }> = [];
  for (const page of pages) {
    const pageName = `page-${String(page.index).padStart(6, "0")}`;
    const runDir = path.join(tempDir, "data", "ocr", "ocr-run-1", pageName);
    await fs.mkdir(runDir, { recursive: true });
    const jsonPath = path.join(runDir, `${pageName}.json`);
    await fs.writeFile(
      jsonPath,
      JSON.stringify({
        blocks: page.blocks
      }),
      "utf8"
    );
    metadataPages.push({ index: page.index, jsonPath });
  }

  await fs.writeFile(
    path.join(tempDir, "data", "ocr", "ocr-run-1", "ocr-run.json"),
    JSON.stringify({
      runId: "ocr-run-1",
      engine: "ndloocr-lite",
      startedAt: "2026-05-23T00:00:00.000Z",
      pages: metadataPages,
      errors: []
    }),
    "utf8"
  );
}
