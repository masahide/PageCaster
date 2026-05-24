export type Viewport = {
  width: number;
  height: number;
};

export type Clip = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EnvConfig = {
  kindleUrl: string;
  headless: boolean;
  browserChannel?: string;
  playwrightCliCommand: string;
  playwrightCliSession: string;
  viewport: Viewport;
  clip: Clip;
  pageChangeTimeoutMs: number;
  pageChangePollMs: number;
  pageTurnKey: string;
};

export type OcrEngine = "ndloocr-lite";

export type OcrConfig = {
  engine: OcrEngine;
  ndloocrLiteCommand: string;
  ndloocrLitePython?: string;
  ndloocrLiteSrcDir?: string;
  ndloocrLiteJsonOnly: boolean;
  ndloocrLiteEnableTcy: boolean;
  ocrTimeoutMs: number;
};

export type OcrInput = {
  index: number;
  sourceImagePath: string;
};

export type OcrPageResult = {
  index: number;
  sourceImagePath: string;
  outputDir: string;
  textPath?: string;
  jsonPath?: string;
  textLength: number;
  elapsedMs: number;
};

export type OcrErrorCode =
  | "OCR_ENGINE_NOT_FOUND"
  | "INPUT_IMAGE_NOT_FOUND"
  | "OCR_PROCESS_FAILED"
  | "EMPTY_OCR_RESULT"
  | "OCR_OUTPUT_NOT_FOUND"
  | "CONFIG_INVALID";

export type OcrError = {
  code: OcrErrorCode;
  message: string;
  pageIndex?: number;
  occurredAt: string;
};

export type OcrRun = {
  runId: string;
  sourceRunId?: string;
  engine: OcrEngine;
  startedAt: string;
  completedAt?: string;
  pages: OcrPageResult[];
  errors: OcrError[];
};

export type TextPrepConfig = {
  llmEnabled: boolean;
  llmProvider: "lmstudio";
  llmBaseUrl: string;
  llmModel?: string;
  llmTimeoutMs: number;
  llmCorrectionMode: "edits" | "anchor";
  llmMaxEditRatio: number;
  llmMaxTokens: number;
  llmMaxFixesPerChunk: number;
  llmMaxAnchorChars: number;
  llmMaxFixRatio: number;
  llmDebugSaveResponses: boolean;
  textChunkMaxChars: number;
  textChunkMinChars: number;
  textSplitMode: "local" | "llm";
  textEnableLlmBoundary: boolean;
  textPageBreakJoin: boolean;
};

export type OcrTextInput = {
  index: number;
  sourceJsonPath: string;
};

export type PreparedTextPage = {
  index: number;
  sourceJsonPath: string;
  rawTextPath: string;
  normalizedTextPath: string;
  correctedTextPath?: string;
  rawTextLength: number;
  correctedTextLength: number;
  usedLlm: boolean;
  elapsedMs: number;
  skipReason?: "TOC";
};

export type TextChunk = {
  id: string;
  pageIndex: number;
  order: number;
  text: string;
  charLength: number;
  sourcePageIndexes?: number[];
  boundaryStartId?: string;
  boundaryEndId?: string;
  splitReason?: "local" | "llm" | "hard";
  correction?: TextChunkCorrection;
};

export type DocumentSegment = {
  id: string;
  pageIndex: number;
  text: string;
  kind: "text" | "page_break";
  joined?: boolean;
};

export type DocumentStream = {
  runId: string;
  segments: DocumentSegment[];
  skippedPages: Array<{
    pageIndex: number;
    reason: "TOC" | "EMPTY";
  }>;
};

export type BoundaryCandidateKind =
  | "sentence_end"
  | "paragraph"
  | "comma"
  | "page_break"
  | "hard";

export type BoundaryCandidate = {
  id: string;
  offset: number;
  pageIndex: number;
  kind: BoundaryCandidateKind;
  strength: number;
  beforePreview: string;
  afterPreview: string;
};

export type TextChunkCorrection = {
  usedLlm: boolean;
  acceptedEditCount: number;
  rejectedEditCount: number;
  fallbackReason?: TextPrepErrorCode;
  rejectReasons?: Array<ChunkEditRejectCode | AnchorFixRejectCode>;
  mode?: "edits" | "anchor";
};

export type AnchorFix = {
  anchor: string;
  target: string;
  to: string;
};

export type AnchorFixRejectCode =
  | "ANCHOR_NOT_FOUND"
  | "ANCHOR_NOT_UNIQUE"
  | "ANCHOR_TOO_LONG"
  | "EMPTY_ANCHOR"
  | "EMPTY_TARGET"
  | "EMPTY_TO"
  | "TARGET_NOT_FOUND_IN_ANCHOR"
  | "ADDS_UNSEEN_NUMBER"
  | "ADDS_OMISSION_MARKER"
  | "TOO_MUCH_CHANGE"
  | "TOO_MANY_FIXES"
  | "TOO_LONG_AFTER_FIX";

export type RejectedAnchorFix = {
  fix: AnchorFix;
  code: AnchorFixRejectCode;
  message: string;
};

export type AnchorFixValidationResult = {
  accepted: AnchorFix[];
  rejected: RejectedAnchorFix[];
};

export type ChunkEdit = {
  from: string;
  to: string;
  reason?: string;
};

export type ChunkEditRejectCode =
  | "FROM_NOT_FOUND"
  | "EMPTY_FROM"
  | "EMPTY_TO"
  | "TOO_MUCH_CHANGE"
  | "ADDS_UNSEEN_NUMBER"
  | "ADDS_OMISSION_MARKER"
  | "CREATES_DUPLICATE_PARTICLE"
  | "EXPANDS_SHORT_KANA_TOKEN"
  | "SCHEMA_INVALID";

export type RejectedChunkEdit = {
  edit: ChunkEdit;
  code: ChunkEditRejectCode;
  message: string;
};

export type ChunkEditValidationResult = {
  accepted: ChunkEdit[];
  rejected: RejectedChunkEdit[];
};

export type TextPrepErrorCode =
  | "INPUT_OCR_NOT_FOUND"
  | "EMPTY_TEXT_INPUT"
  | "LLM_REQUEST_FAILED"
  | "LLM_RESPONSE_INVALID"
  | "LLM_EDIT_REJECTED"
  | "BOUNDARY_SELECTION_FAILED"
  | "DOCUMENT_ASSEMBLY_FAILED"
  | "CONFIG_INVALID";

export type TextPrepError = {
  code: TextPrepErrorCode;
  message: string;
  pageIndex?: number;
  chunkId?: string;
  occurredAt: string;
};

export type LlmCallLog = {
  id: string;
  provider: "lmstudio";
  purpose: "ocr_fix";
  mode: "anchor" | "edits";
  chunkId: string;
  pageIndex: number;
  textLength: number;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  status?: number;
  ok?: boolean;
  model?: string;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  contentLength?: number;
  reasoningContentLength?: number;
  transportError?: LlmTransportError;
  acceptedEditCount?: number;
  rejectedEditCount?: number;
  fallbackReason?: TextPrepErrorCode;
  errorCode?: TextPrepErrorCode;
  errorMessage?: string;
  debugPath?: string;
};

export type LlmTransportError = {
  name?: string;
  message: string;
  code?: string;
  errno?: number;
  syscall?: string;
  address?: string;
  port?: number;
  stack?: string;
  cause?: LlmTransportError;
};

export type TextRun = {
  runId: string;
  sourceOcrRunId?: string;
  llmEnabled: boolean;
  llmModel?: string;
  splitMode?: "local" | "llm";
  pageBreakJoin?: boolean;
  textChunkMaxChars?: number;
  llmBoundaryEnabled?: boolean;
  llmDebugSaveResponses?: boolean;
  skippedPages?: DocumentStream["skippedPages"];
  pageBreakJoinCount?: number;
  boundarySelection?: {
    mode: "local" | "llm";
    boundaryCount: number;
    selectedBoundaryIds: string[];
    fallbackReason?: TextPrepErrorCode;
  };
  startedAt: string;
  completedAt?: string;
  pages: PreparedTextPage[];
  chunks: TextChunk[];
  errors: TextPrepError[];
  llmCalls?: LlmCallLog[];
};

export type CapturedPage = {
  index: number;
  screenshotPath: string;
  sha256: string;
  capturedAt: string;
};

export type CaptureErrorCode =
  | "NOT_LOGGED_IN"
  | "PAGE_CHANGE_TIMEOUT"
  | "CAPTURE_FAILED"
  | "CONFIG_INVALID";

export type CaptureError = {
  code: CaptureErrorCode;
  message: string;
  pageIndex?: number;
  occurredAt: string;
};

export type CaptureRun = {
  runId: string;
  kindleUrl: string;
  viewport: Viewport;
  clip: Clip;
  pages: CapturedPage[];
  errors: CaptureError[];
};
