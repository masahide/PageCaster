import fs from "node:fs/promises";
import path from "node:path";

export class OcrOutputReader {
  async findJson(outputDir: string): Promise<string | undefined> {
    return this.findFirstByExtension(outputDir, ".json");
  }

  async findText(outputDir: string): Promise<string | undefined> {
    return this.findFirstByExtension(outputDir, ".txt");
  }

  async readText(outputDir: string): Promise<string> {
    const textPath = await this.findText(outputDir);
    if (textPath) {
      return fs.readFile(textPath, "utf8");
    }

    const jsonPath = await this.findJson(outputDir);
    if (!jsonPath) {
      return "";
    }

    return extractTextFromJson(JSON.parse(await fs.readFile(jsonPath, "utf8")));
  }

  private async findFirstByExtension(
    outputDir: string,
    extension: string
  ): Promise<string | undefined> {
    const entries = await fs.readdir(outputDir, {
      recursive: true,
      withFileTypes: true
    });
    const found = entries.find(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension)
    );

    if (!found) {
      return undefined;
    }

    return path.join(found.parentPath, found.name);
  }
}

function extractTextFromJson(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractTextFromJson).filter(Boolean).join("\n");
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const textLikeKeys = ["text", "contents", "content", "string"];
    const directText = textLikeKeys
      .map((key) => record[key])
      .filter((candidate): candidate is string => typeof candidate === "string")
      .join("\n");

    if (directText) {
      return directText;
    }

    return Object.values(record).map(extractTextFromJson).filter(Boolean).join("\n");
  }

  return "";
}
