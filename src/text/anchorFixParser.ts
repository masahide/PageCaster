import type { AnchorFix } from "../types.js";

export class AnchorFixParser {
  parse(content: string): AnchorFix[] {
    return parseAnchorFixContent(content);
  }
}

export function parseAnchorFixContent(content: string): AnchorFix[] {
  const trimmed = content.trim();

  if (trimmed === "NO_FIX") {
    return [];
  }

  if (trimmed.includes("```")) {
    throw invalid("Markdown fences are not allowed in anchor fix responses.");
  }

  const fixMatches = [...trimmed.matchAll(/<fix>([\s\S]*?)<\/fix>/g)];
  if (fixMatches.length === 0) {
    throw invalid("Expected one or more fix tags, or NO_FIX.");
  }

  const outsideFixes = trimmed.replace(/<fix>[\s\S]*?<\/fix>/g, "").trim();
  if (outsideFixes.length > 0) {
    throw invalid("Unexpected text outside fix tags.");
  }

  return fixMatches.map((match) => {
    const body = match[1] ?? "";
    return {
      anchor: readRequiredTag(body, "anchor"),
      target: readRequiredTag(body, "target"),
      to: readRequiredTag(body, "to")
    };
  });
}

function readRequiredTag(body: string, tagName: "anchor" | "target" | "to"): string {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(
    new RegExp(`<${escapedTagName}>([\\s\\S]*?)<\\/${escapedTagName}>`)
  );

  if (!match) {
    throw invalid(`Missing ${tagName} tag.`);
  }

  return decodeXmlEntities((match[1] ?? "").trim());
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function invalid(message: string): Error {
  return new Error(`LLM_RESPONSE_INVALID: ${message}`);
}
