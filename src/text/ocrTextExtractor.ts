import fs from "node:fs/promises";

const textLikeKeys = new Set(["text", "contents", "content", "string"]);
const ignoredKeys = new Set(["img_path", "image_path", "source_image_path"]);

export class OcrTextExtractor {
  async extract(jsonPath: string): Promise<string> {
    const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
    return extractText(json).trim();
  }
}

function extractText(value: unknown, parentKey?: string): string {
  if (typeof value === "string") {
    return parentKey && textLikeKeys.has(parentKey.toLowerCase()) ? value : "";
  }

  if (Array.isArray(value)) {
    return value.map((item) => extractText(item, parentKey)).filter(Boolean).join("\n");
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const directText = Object.entries(record)
      .filter(([key, candidate]) => textLikeKeys.has(key.toLowerCase()) && typeof candidate === "string")
      .map(([, candidate]) => candidate as string)
      .join("\n");

    if (directText) {
      return directText;
    }

    return Object.entries(record)
      .filter(([key]) => !ignoredKeys.has(key.toLowerCase()))
      .map(([key, candidate]) => extractText(candidate, key))
      .filter(Boolean)
      .join("\n");
  }

  return "";
}
