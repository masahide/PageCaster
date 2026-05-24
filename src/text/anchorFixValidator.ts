import type {
  AnchorFix,
  AnchorFixRejectCode,
  AnchorFixValidationResult,
  RejectedAnchorFix
} from "../types.js";

const omissionMarkerPattern = /以下略|省略しました|省略する|省略|続きは|ここまで|要約/;
const numberPattern = /[0-9０-９]+|[〇零一二三四五六七八九十百千万億兆]+(?=[歳年月日人個円])/g;

export type AnchorFixValidatorOptions = {
  maxFixesPerChunk: number;
  maxAnchorChars: number;
  maxFixRatio: number;
};

export class AnchorFixValidator {
  constructor(
    private readonly options: AnchorFixValidatorOptions = {
      maxFixesPerChunk: 5,
      maxAnchorChars: 40,
      maxFixRatio: 0.25
    }
  ) {}

  validate(chunkText: string, fixes: AnchorFix[]): AnchorFixValidationResult {
    if (fixes.length > this.options.maxFixesPerChunk) {
      return {
        accepted: [],
        rejected: fixes.map((fix) =>
          reject(fix, "TOO_MANY_FIXES", "Too many fixes were returned for one chunk.")
        )
      };
    }

    const accepted: AnchorFix[] = [];
    const rejected: RejectedAnchorFix[] = [];

    for (const fix of fixes) {
      const rejection = this.validateOne(chunkText, fix);
      if (rejection) {
        rejected.push(rejection);
      } else {
        accepted.push(fix);
      }
    }

    return { accepted, rejected };
  }

  private validateOne(chunkText: string, fix: AnchorFix): RejectedAnchorFix | undefined {
    if (!fix.anchor) {
      return reject(fix, "EMPTY_ANCHOR", "fix.anchor must not be empty.");
    }

    if (!fix.target) {
      return reject(fix, "EMPTY_TARGET", "fix.target must not be empty.");
    }

    if (!fix.to) {
      return reject(fix, "EMPTY_TO", "fix.to must not be empty.");
    }

    if (fix.anchor.length > this.options.maxAnchorChars) {
      return reject(fix, "ANCHOR_TOO_LONG", "fix.anchor is longer than allowed.");
    }

    const anchorOccurrences = countOccurrences(chunkText, fix.anchor);
    if (anchorOccurrences === 0) {
      return reject(fix, "ANCHOR_NOT_FOUND", "fix.anchor was not found in the source chunk.");
    }

    if (anchorOccurrences > 1) {
      return reject(fix, "ANCHOR_NOT_UNIQUE", "fix.anchor appears multiple times in the source chunk.");
    }

    if (!fix.anchor.includes(fix.target)) {
      return reject(fix, "TARGET_NOT_FOUND_IN_ANCHOR", "fix.target was not found in fix.anchor.");
    }

    if (addsUnseenNumber(chunkText, fix.to)) {
      return reject(fix, "ADDS_UNSEEN_NUMBER", "fix.to adds a number that was not in the source chunk.");
    }

    if (addsOmissionMarker(chunkText, fix.to)) {
      return reject(fix, "ADDS_OMISSION_MARKER", "fix.to adds an omission marker.");
    }

    if (changeRatio(chunkText, fix) > this.options.maxFixRatio) {
      return reject(fix, "TOO_MUCH_CHANGE", "fix changes too much text for a single chunk.");
    }

    return undefined;
  }
}

function reject(
  fix: AnchorFix,
  code: AnchorFixRejectCode,
  message: string
): RejectedAnchorFix {
  return { fix, code, message };
}

function countOccurrences(text: string, needle: string): number {
  let count = 0;
  let index = text.indexOf(needle);
  while (index >= 0) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

function addsUnseenNumber(chunkText: string, replacement: string): boolean {
  const sourceNumbers = new Set(extractNumbers(chunkText));
  return extractNumbers(replacement).some((number) => !sourceNumbers.has(number));
}

function extractNumbers(text: string): string[] {
  return text.match(numberPattern) ?? [];
}

function addsOmissionMarker(chunkText: string, replacement: string): boolean {
  return omissionMarkerPattern.test(replacement) && !omissionMarkerPattern.test(chunkText);
}

function changeRatio(chunkText: string, fix: AnchorFix): number {
  return levenshteinDistance(fix.target, fix.to) / Math.max(chunkText.length, 1);
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const replaceCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      current[rightIndex + 1] = Math.min(
        current[rightIndex] + 1,
        previous[rightIndex + 1] + 1,
        previous[rightIndex] + replaceCost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length] ?? 0;
}
