import type { CaptureErrorCode } from "./types.js";
import type { OcrErrorCode } from "./types.js";
import type { TextPrepErrorCode } from "./types.js";

export class AppError extends Error {
  constructor(
    readonly code: CaptureErrorCode,
    message: string,
    readonly pageIndex?: number
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class OcrAppError extends Error {
  constructor(
    readonly code: OcrErrorCode,
    message: string,
    readonly pageIndex?: number
  ) {
    super(message);
    this.name = "OcrAppError";
  }
}

export class TextPrepAppError extends Error {
  constructor(
    readonly code: TextPrepErrorCode,
    message: string,
    readonly pageIndex?: number
  ) {
    super(message);
    this.name = "TextPrepAppError";
  }
}
