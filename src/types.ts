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
