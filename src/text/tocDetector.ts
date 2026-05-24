export function isTableOfContentsText(text: string): boolean {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return false;
  }

  const header = lines.slice(0, 5).join("");
  if (!header.includes("目次")) {
    return false;
  }

  const markerCount = lines.filter(isTocMarkerLine).length;
  return markerCount >= 4;
}

function isTocMarkerLine(line: string): boolean {
  return (
    /^CHAPTER\s*\d*/i.test(line) ||
    /^EYE\b/i.test(line) ||
    /^EYE[0-9A-Za-z]*\s*/i.test(line)
  );
}
