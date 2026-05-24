import { z } from "zod";
import type { ChunkEdit, TextChunk, TextPrepConfig } from "../types.js";

type FetchLike = typeof fetch;

const editResponseSchema = z.object({
  edits: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      reason: z.string().optional()
    })
  )
});

export class LmStudioEditClient {
  constructor(
    private readonly config: TextPrepConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  buildChatRequest(chunk: Pick<TextChunk, "id" | "text">) {
    return {
      ...(this.config.llmModel ? { model: this.config.llmModel } : {}),
      messages: [
        {
          role: "system" as const,
          content: [
            "あなたはOCR誤りの修正候補だけを返すエンジンです。",
            "本文全文を返してはいけません。",
            "JSONのみを返してください。",
            "入力chunk内に存在する文字列を from に指定し、その置換候補を to に指定してください。",
            "入力にない内容、推測した数字、要約、省略、続きを追加してはいけません。",
            '修正不要なら {"edits":[]} を返してください。'
          ].join("\n")
        },
        {
          role: "user" as const,
          content: [
            `<chunk id="${chunk.id}">`,
            chunk.text,
            "</chunk>",
            "",
            "Return JSON only:",
            '{"edits":[{"from":"...","to":"...","reason":"..."}]}'
          ].join("\n")
        }
      ],
      temperature: 0,
      stream: false,
      max_tokens: 512
    };
  }

  async proposeEdits(chunk: Pick<TextChunk, "id" | "text">): Promise<ChunkEdit[]> {
    const response = await this.fetchWithTimeout(
      `${this.config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(this.buildChatRequest(chunk))
      }
    );

    if (!response.ok) {
      throw new Error(
        `LLM_REQUEST_FAILED: LM Studio request failed with status ${response.status}: ${await readErrorBody(response)}`
      );
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("LLM_RESPONSE_INVALID: LM Studio response did not contain message content.");
    }

    return parseEditContent(content);
  }

  private async fetchWithTimeout(
    url: string,
    init?: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.llmTimeoutMs);
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 500) || response.statusText;
}

function parseEditContent(content: string): ChunkEdit[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    throw new Error("LLM_RESPONSE_INVALID: LM Studio edit response was not valid JSON.");
  }

  const result = editResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("LLM_RESPONSE_INVALID: LM Studio edit response did not match the expected schema.");
  }

  return result.data.edits;
}

function extractJsonObject(content: string): string {
  const withoutFence = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (withoutFence.startsWith("{") && withoutFence.endsWith("}")) {
    return withoutFence;
  }

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return withoutFence.slice(start, end + 1);
  }

  return withoutFence;
}
