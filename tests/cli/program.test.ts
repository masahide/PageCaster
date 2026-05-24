import { describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli/program.js";

describe("createProgram", () => {
  it("dispatches capture with parsed page count", async () => {
    const handlers = {
      login: vi.fn(),
      capture: vi.fn(),
      captureDebug: vi.fn(),
      ocr: vi.fn(),
      prepareText: vi.fn()
    };
    const program = createProgram(handlers);

    await program.parseAsync(["capture", "--pages", "2"], { from: "user" });

    expect(handlers.capture).toHaveBeenCalledWith(2, "auto", true);
  });

  it("dispatches capture with manual turn mode", async () => {
    const handlers = {
      login: vi.fn(),
      capture: vi.fn(),
      captureDebug: vi.fn(),
      ocr: vi.fn(),
      prepareText: vi.fn()
    };
    const program = createProgram(handlers);

    await program.parseAsync(
      ["capture", "--pages", "2", "--turn-mode", "manual"],
      { from: "user" }
    );

    expect(handlers.capture).toHaveBeenCalledWith(2, "manual", true);
  });

  it("dispatches capture without start confirmation", async () => {
    const handlers = {
      login: vi.fn(),
      capture: vi.fn(),
      captureDebug: vi.fn(),
      ocr: vi.fn(),
      prepareText: vi.fn()
    };
    const program = createProgram(handlers);

    await program.parseAsync(["capture", "--pages", "1", "--no-confirm-start"], {
      from: "user"
    });

    expect(handlers.capture).toHaveBeenCalledWith(1, "auto", false);
  });

  it("dispatches capture:debug", async () => {
    const handlers = {
      login: vi.fn(),
      capture: vi.fn(),
      captureDebug: vi.fn(),
      ocr: vi.fn(),
      prepareText: vi.fn()
    };
    const program = createProgram(handlers);

    await program.parseAsync(["capture:debug"], {
      from: "user"
    });

    expect(handlers.captureDebug).toHaveBeenCalledOnce();
  });

  it("dispatches ocr command", async () => {
    const handlers = {
      login: vi.fn(),
      capture: vi.fn(),
      captureDebug: vi.fn(),
      ocr: vi.fn(),
      prepareText: vi.fn()
    };
    const program = createProgram(handlers);

    await program.parseAsync(["ocr", "--run-id", "run-1", "--pages", "1-2"], {
      from: "user"
    });

    expect(handlers.ocr).toHaveBeenCalledWith({
      runId: "run-1",
      pages: "1-2"
    });
  });

  it("dispatches prepare-text command", async () => {
    const handlers = {
      login: vi.fn(),
      capture: vi.fn(),
      captureDebug: vi.fn(),
      ocr: vi.fn(),
      prepareText: vi.fn()
    };
    const program = createProgram(handlers);

    await program.parseAsync(
      ["prepare-text", "--ocr-run-id", "ocr-run-1", "--pages", "1-2"],
      { from: "user" }
    );

    expect(handlers.prepareText).toHaveBeenCalledWith({
      ocrRunId: "ocr-run-1",
      pages: "1-2",
      ocrCorrection: true
    });
  });

  it("dispatches prepare-text with exclude-toc", async () => {
    const handlers = {
      login: vi.fn(),
      capture: vi.fn(),
      captureDebug: vi.fn(),
      ocr: vi.fn(),
      prepareText: vi.fn()
    };
    const program = createProgram(handlers);

    await program.parseAsync(
      ["prepare-text", "--ocr-run-id", "ocr-run-1", "--exclude-toc"],
      { from: "user" }
    );

    expect(handlers.prepareText).toHaveBeenCalledWith({
      ocrRunId: "ocr-run-1",
      excludeToc: true,
      ocrCorrection: true
    });
  });

  it("dispatches prepare-text without OCR correction", async () => {
    const handlers = {
      login: vi.fn(),
      capture: vi.fn(),
      captureDebug: vi.fn(),
      ocr: vi.fn(),
      prepareText: vi.fn()
    };
    const program = createProgram(handlers);

    await program.parseAsync(
      ["prepare-text", "--ocr-run-id", "ocr-run-1", "--no-ocr-correction"],
      { from: "user" }
    );

    expect(handlers.prepareText).toHaveBeenCalledWith({
      ocrRunId: "ocr-run-1",
      ocrCorrection: false
    });
  });
});
