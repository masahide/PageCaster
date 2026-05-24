import type { BoundaryCandidate, TextPrepConfig } from "../types.js";

type FetchLike = typeof fetch;

export type LlmBoundarySelectionInput = {
  context: string;
  boundaries: BoundaryCandidate[];
};

export class LlmBoundarySelector {
  constructor(
    private readonly config: TextPrepConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  buildChatRequest(input: LlmBoundarySelectionInput) {
    return {
      ...(this.config.llmModel ? { model: this.config.llmModel } : {}),
      messages: [
        {
          role: "system" as const,
          content: [
            "あなたはTTS向けchunk境界を選ぶエンジンです。",
            "本文を書き換えたり、本文全文を返したりしてはいけません。",
            '返答は <split id="..."/> のタグだけにしてください。',
            "説明、引用、Markdown、JSONは禁止です。"
          ].join("\n")
        },
        {
          role: "user" as const,
          content: [
            "<context>",
            input.context,
            "</context>",
            "",
            "<boundaries>",
            ...input.boundaries.map(
              (boundary) =>
                `<b id="${boundary.id}" kind="${boundary.kind}" strength="${boundary.strength}">${boundary.beforePreview}|${boundary.afterPreview}</b>`
            ),
            "</boundaries>",
            "",
            "Return only split tags:",
            '<split id="b0001"/>'
          ].join("\n")
        }
      ],
      temperature: 0,
      stream: false,
      max_tokens: this.config.llmMaxTokens
    };
  }

  async select(input: LlmBoundarySelectionInput): Promise<string[]> {
    const response = await this.fetchWithTimeout(
      `${this.config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(this.buildChatRequest(input))
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

    return parseSplitIds(
      content,
      new Set(input.boundaries.map((boundary) => boundary.id))
    );
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

export function parseSplitIds(content: string, allowedIds: Set<string>): string[] {
  const trimmed = content.trim();
  const splitTagPattern = /<split\s+id="([^"]+)"\s*\/>/g;
  const ids = Array.from(trimmed.matchAll(splitTagPattern), (match) => match[1]);
  const withoutTags = trimmed.replace(splitTagPattern, "").trim();

  if (ids.length === 0 || withoutTags.length > 0) {
    throw new Error("LLM_RESPONSE_INVALID: boundary response must contain only split tags.");
  }

  for (const id of ids) {
    if (!allowedIds.has(id)) {
      throw new Error(`LLM_RESPONSE_INVALID: unknown boundary id: ${id}`);
    }
  }

  return ids;
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 500) || response.statusText;
}
