import type {
  AnchorFix,
  LlmTransportError,
  TextChunk,
  TextPrepConfig
} from "../types.js";
import { parseAnchorFixContent } from "./anchorFixParser.js";

type FetchLike = typeof fetch;

export type LmStudioAnchorFixTrace = {
  request: unknown;
  response?: unknown;
  rawResponseBody?: string;
  content?: string;
  reasoningContent?: string;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  status?: number;
  ok?: boolean;
  model?: string;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  transportError?: LlmTransportError;
};

export type LmStudioAnchorFixResult = {
  fixes: AnchorFix[];
  trace: LmStudioAnchorFixTrace;
};

export class LmStudioAnchorFixError extends Error {
  constructor(
    message: string,
    readonly trace: LmStudioAnchorFixTrace
  ) {
    super(message);
    this.name = "LmStudioAnchorFixError";
  }
}

export class LmStudioAnchorFixClient {
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
            "あなたはOCR誤りの修正候補だけを短く返すエンジンです。",
            "考察しないでください。",
            "本文全文を返してはいけません。",
            "修正候補だけを最大5件返してください。",
            "修正不要なら NO_FIX のみ返してください。",
            "",
            "出力形式:",
            "<fix><anchor>置換箇所を含む短い原文</anchor><target>置換対象</target><to>置換後</to></fix>",
            "",
            "ルール:",
            "- <anchor> は入力chunk内に完全一致する短い文字列",
            "- <target> は <anchor> の中に完全一致する文字列",
            "- <to> は置換後の文字列",
            "- 入力内にある明白なカタカナOCR誤りだけ返す",
            "- 迷う候補は返さない",
            "- 例に出ている修正も、入力本文に存在するなら返してよい",
            "- 推測で数字、固有名詞、続きを補わない",
            "- 要約、省略、本文全文は禁止",
            "- Markdown、JSON、説明文は禁止"
          ].join("\n")
        },
        {
          role: "user" as const,
          content: [
            `<chunk id="${chunk.id}">`,
            chunk.text,
            "</chunk>",
            "",
            "Output examples:",
            "<fix><anchor>広報担当者から来たメツセ</anchor><target>メツセ</target><to>メッセ</to></fix>",
            "NO_FIX"
          ].join("\n")
        }
      ],
      temperature: 0,
      stream: false,
      max_tokens: this.config.llmMaxTokens
    };
  }

  async proposeFixes(chunk: Pick<TextChunk, "id" | "text">): Promise<AnchorFix[]> {
    return (await this.proposeFixesWithTrace(chunk)).fixes;
  }

  async proposeFixesWithTrace(
    chunk: Pick<TextChunk, "id" | "text">
  ): Promise<LmStudioAnchorFixResult> {
    const request = this.buildChatRequest(chunk);
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        `${this.config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(request)
        }
      );
    } catch (error) {
      const completedAtMs = Date.now();
      const transportError = serializeTransportError(error);
      throw new LmStudioAnchorFixError(
        `LLM_REQUEST_FAILED: ${formatTransportError(transportError)}`,
        {
          request,
          startedAt,
          completedAt: new Date(completedAtMs).toISOString(),
          elapsedMs: completedAtMs - startedAtMs,
          transportError
        }
      );
    }
    const rawResponseBody = await response.text();
    const completedAtMs = Date.now();
    let json: ChatCompletionResponse | undefined;
    try {
      json = JSON.parse(rawResponseBody) as ChatCompletionResponse;
    } catch {
      // Keep json undefined. The invalid body is preserved in debug output.
    }
    const trace = buildTrace({
      request,
      response,
      rawResponseBody,
      json,
      startedAt,
      completedAt: new Date(completedAtMs).toISOString(),
      elapsedMs: completedAtMs - startedAtMs
    });

    if (!response.ok) {
      throw new LmStudioAnchorFixError(
        `LLM_REQUEST_FAILED: LM Studio request failed with status ${response.status}: ${readErrorBody(rawResponseBody, response.statusText)}`,
        trace
      );
    }

    if (!json) {
      throw new LmStudioAnchorFixError(
        "LLM_RESPONSE_INVALID: LM Studio response was not valid JSON.",
        trace
      );
    }

    const content = trace.content?.trim();

    if (!content) {
      throw new LmStudioAnchorFixError(
        "LLM_RESPONSE_INVALID: LM Studio response did not contain message content.",
        trace
      );
    }

    try {
      return {
        fixes: parseAnchorFixContent(content),
        trace
      };
    } catch (error) {
      throw new LmStudioAnchorFixError(
        error instanceof Error ? error.message : String(error),
        trace
      );
    }
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

type ChatCompletionResponse = {
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
};

function buildTrace({
  request,
  response,
  rawResponseBody,
  json,
  startedAt,
  completedAt,
  elapsedMs
}: {
  request: unknown;
  response: Response;
  rawResponseBody: string;
  json?: ChatCompletionResponse;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
}): LmStudioAnchorFixTrace {
  const choice = json?.choices?.[0];
  return {
    request,
    response: json,
    rawResponseBody,
    content: choice?.message?.content,
    reasoningContent: choice?.message?.reasoning_content,
    startedAt,
    completedAt,
    elapsedMs,
    status: response.status,
    ok: response.ok,
    model: json?.model,
    finishReason: choice?.finish_reason,
    promptTokens: json?.usage?.prompt_tokens,
    completionTokens: json?.usage?.completion_tokens,
    reasoningTokens: json?.usage?.completion_tokens_details?.reasoning_tokens,
    totalTokens: json?.usage?.total_tokens
  };
}

function readErrorBody(text: string, statusText: string): string {
  return text.slice(0, 500) || statusText;
}

function serializeTransportError(error: unknown): LlmTransportError {
  if (!isRecord(error)) {
    return { message: String(error) };
  }

  const cause = error.cause;
  return {
    name: typeof error.name === "string" ? error.name : undefined,
    message: typeof error.message === "string" ? error.message : String(error),
    code: typeof error.code === "string" ? error.code : undefined,
    errno: typeof error.errno === "number" ? error.errno : undefined,
    syscall: typeof error.syscall === "string" ? error.syscall : undefined,
    address: typeof error.address === "string" ? error.address : undefined,
    port: typeof error.port === "number" ? error.port : undefined,
    stack: typeof error.stack === "string" ? error.stack : undefined,
    cause: cause === undefined ? undefined : serializeTransportError(cause)
  };
}

function formatTransportError(error: LlmTransportError): string {
  const detail = error.cause ?? error;
  const parts = [
    error.name,
    error.message,
    detail.code,
    detail.syscall,
    detail.address,
    detail.port === undefined ? undefined : String(detail.port)
  ].filter(Boolean);
  return parts.join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
