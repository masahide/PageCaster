import type {
  ChunkEdit,
  ChunkEditRejectCode,
  ChunkEditValidationResult,
  RejectedChunkEdit
} from "../types.js";

const omissionMarkerPattern = /以下略|省略しました|省略する|省略|続きは|ここまで|要約/;
const numberPattern = /[0-9０-９]+|[〇零一二三四五六七八九十百千万億兆]+(?=[歳年月日人個円])/g;

export class ChunkEditValidator {
  constructor(private readonly maxEditRatio = 0.25) {}

  validate(chunkText: string, edits: ChunkEdit[]): ChunkEditValidationResult {
    const accepted: ChunkEdit[] = [];
    const rejected: RejectedChunkEdit[] = [];

    for (const edit of edits) {
      const rejection = this.validateOne(chunkText, edit);
      if (rejection) {
        rejected.push(rejection);
      } else {
        accepted.push(edit);
      }
    }

    return { accepted, rejected };
  }

  private validateOne(chunkText: string, edit: ChunkEdit): RejectedChunkEdit | undefined {
    if (!edit.from) {
      return reject(edit, "EMPTY_FROM", "edit.from must not be empty.");
    }

    if (!edit.to) {
      return reject(edit, "EMPTY_TO", "edit.to must not be empty.");
    }

    if (!chunkText.includes(edit.from)) {
      return reject(edit, "FROM_NOT_FOUND", "edit.from was not found in the source chunk.");
    }

    if (addsUnseenNumber(chunkText, edit.to)) {
      return reject(edit, "ADDS_UNSEEN_NUMBER", "edit.to adds a number that was not in the source chunk.");
    }

    if (addsOmissionMarker(chunkText, edit.to)) {
      return reject(edit, "ADDS_OMISSION_MARKER", "edit.to adds an omission marker.");
    }

    if (expandsShortKanaToken(edit)) {
      return reject(
        edit,
        "EXPANDS_SHORT_KANA_TOKEN",
        "edit expands a short kana token instead of only correcting OCR glyphs."
      );
    }

    if (createsDuplicateParticle(chunkText, edit)) {
      return reject(
        edit,
        "CREATES_DUPLICATE_PARTICLE",
        "edit creates a duplicated Japanese particle at the replacement boundary."
      );
    }

    if (changeRatio(chunkText, edit) > this.maxEditRatio) {
      return reject(edit, "TOO_MUCH_CHANGE", "edit changes too much text for a single chunk.");
    }

    return undefined;
  }
}

function reject(
  edit: ChunkEdit,
  code: ChunkEditRejectCode,
  message: string
): RejectedChunkEdit {
  return { edit, code, message };
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

function expandsShortKanaToken(edit: ChunkEdit): boolean {
  const fromRuns = extractKanaRuns(edit.from);
  const toRuns = extractKanaRuns(edit.to);
  return fromRuns.some((fromRun, index) => {
    const toRun = toRuns[index];
    return Boolean(
      toRun &&
        fromRun.length <= 4 &&
        toRun.length - fromRun.length > 1
    );
  });
}

function extractKanaRuns(text: string): string[] {
  return text.match(/[ァ-ヴー]+/g) ?? [];
}

function createsDuplicateParticle(chunkText: string, edit: ChunkEdit): boolean {
  const index = chunkText.indexOf(edit.from);
  if (index < 0) {
    return false;
  }

  const candidate = `${chunkText.slice(0, index)}${edit.to}${chunkText.slice(index + edit.from.length)}`;
  const left = Math.max(0, index - 2);
  const right = Math.min(candidate.length, index + edit.to.length + 2);
  return /([はがをにへでとも])\1/.test(candidate.slice(left, right));
}

function changeRatio(chunkText: string, edit: ChunkEdit): number {
  return levenshteinDistance(edit.from, edit.to) / Math.max(chunkText.length, 1);
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
