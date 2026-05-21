export function parsePageCount(value: string): number {
  const pageCount = Number(value);

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("pages must be a positive integer");
  }

  return pageCount;
}

export type TurnMode = "auto" | "manual";

export function parseTurnMode(value: string): TurnMode {
  if (value === "auto" || value === "manual") {
    return value;
  }

  throw new Error("turn-mode must be either auto or manual");
}
