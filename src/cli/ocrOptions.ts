export type OcrCliOptions = {
  runId?: string;
  image?: string;
  pages?: string;
};

export type ParsedPageFilter = Set<number> | undefined;

export function validateOcrCliOptions(options: OcrCliOptions): void {
  if (options.runId && options.image) {
    throw new Error("Specify either --run-id or --image, not both.");
  }

  if (!options.runId && !options.image) {
    throw new Error("Specify --run-id or --image.");
  }

  if (options.pages) {
    parsePageFilter(options.pages);
  }
}

export function parsePageFilter(value?: string): ParsedPageFilter {
  if (!value) {
    return undefined;
  }

  const pages = new Set<number>();
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) {
      throw new Error("pages must not contain empty values");
    }

    if (trimmed.includes("-")) {
      const [startRaw, endRaw] = trimmed.split("-");
      const start = parsePositiveInteger(startRaw);
      const end = parsePositiveInteger(endRaw);
      if (start > end) {
        throw new Error("pages range start must be less than or equal to end");
      }
      for (let page = start; page <= end; page += 1) {
        pages.add(page);
      }
      continue;
    }

    pages.add(parsePositiveInteger(trimmed));
  }

  return pages;
}

function parsePositiveInteger(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("pages must be positive integers");
  }
  return parsed;
}
