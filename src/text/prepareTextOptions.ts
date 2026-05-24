export type PrepareTextOptions = {
  ocrRunId?: string;
  ocrJson?: string;
  pages?: string;
  excludeToc?: boolean;
  ocrCorrection?: boolean;
};

export function validatePrepareTextOptions(options: PrepareTextOptions): void {
  if (options.ocrRunId && options.ocrJson) {
    throw new Error("Specify either --ocr-run-id or --ocr-json, not both.");
  }

  if (!options.ocrRunId && !options.ocrJson) {
    throw new Error("Specify --ocr-run-id or --ocr-json.");
  }
}
