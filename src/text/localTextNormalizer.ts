export class LocalTextNormalizer {
  normalize(text: string): string {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t\u3000]+/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !isPageNoise(line))
      .join("\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }
}

function isPageNoise(line: string): boolean {
  return (
    /^Page\s+\d+\s+of\s+\d+%?/i.test(line) ||
    /^\d+\s*\/\s*\d+$/.test(line) ||
    /^\(?\d+\)?$/.test(line) ||
    /^[●○・\-\s]+$/.test(line) ||
    /^Kindle\b/i.test(line) ||
    /^Back to\b/i.test(line) ||
    /\bleft in book\b/i.test(line) ||
    /\bleft in chapter\b/i.test(line) ||
    /^=\s*Aa\b/i.test(line)
  );
}
