import type { TextPrepConfig } from "../types.js";

type FetchLike = typeof fetch;

export type LlmCorrectionResult = {
  text: string;
  model?: string;
};

export class LmStudioClient {
  constructor(
    private readonly config: TextPrepConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  buildChatRequest(text: string) {
    return {
      ...(this.config.llmModel ? { model: this.config.llmModel } : {}),
      messages: [
        {
          role: "system" as const,
          content:
            [
              "あなたは日本語OCR結果の保守的な校正エンジンです。",
              "目的はTTSで読み上げやすくするための最小限の修正だけです。",
              "絶対に要約、省略、加筆、推測補完、順序変更をしないでください。",
              "年齢、年数、固有名詞など読めない箇所は推測せず、入力の表記を維持してください。",
              "明らかなOCR誤り、文字種の誤り、不自然な改行、余分な空白だけを直してください。",
              "本文が途中で切れている場合も、続きを作らず、入力にある範囲だけを出力してください。",
              "「以下略」「省略」「続き」など、入力にない説明や注釈を追加しないでください。",
              "出力は校正済み本文のみ。説明、箇条書き、タグ、コードフェンスは出力しないでください。"
            ].join("\n")
        },
        {
          role: "user" as const,
          content: [
            "次の <ocr_text> 内だけを校正してください。",
            "<ocr_text>",
            text,
            "</ocr_text>"
          ].join("\n")
        }
      ],
      temperature: 0,
      stream: false
    };
  }

  async correctText(text: string): Promise<LlmCorrectionResult> {
    const response = await this.fetchWithTimeout(
      `${this.config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(this.buildChatRequest(text))
      }
    );

    if (!response.ok) {
      throw new Error(`LM Studio request failed with status ${response.status}`);
    }

    const json = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("LM Studio response did not contain message content.");
    }

    if (containsForbiddenOmission(content)) {
      throw new Error("LM Studio response contained a forbidden omission marker.");
    }

    return {
      text: content,
      model: json.model ?? this.config.llmModel
    };
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetchWithTimeout(
      `${this.config.llmBaseUrl.replace(/\/$/, "")}/models`
    );
    if (!response.ok) {
      throw new Error(`LM Studio models request failed with status ${response.status}`);
    }
    const json = (await response.json()) as { data?: Array<{ id?: string }> };
    return json.data?.map((model) => model.id).filter(Boolean) as string[];
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

function containsForbiddenOmission(text: string): boolean {
  return /以下略|省略しました|省略する|続きは|ここまで|要約/.test(text);
}
