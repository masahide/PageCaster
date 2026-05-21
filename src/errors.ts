import type { CaptureErrorCode } from "./types.js";

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
