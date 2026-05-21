import { describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli/program.js";

describe("createProgram", () => {
  it("dispatches capture with parsed page count", async () => {
    const handlers = {
      login: vi.fn(),
      capture: vi.fn(),
      captureDebug: vi.fn()
    };
    const program = createProgram(handlers);

    await program.parseAsync(["capture", "--pages", "2"], { from: "user" });

    expect(handlers.capture).toHaveBeenCalledWith(2, "auto", true);
  });

  it("dispatches capture with manual turn mode", async () => {
    const handlers = {
      login: vi.fn(),
      capture: vi.fn(),
      captureDebug: vi.fn()
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
      captureDebug: vi.fn()
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
      captureDebug: vi.fn()
    };
    const program = createProgram(handlers);

    await program.parseAsync(["capture:debug"], {
      from: "user"
    });

    expect(handlers.captureDebug).toHaveBeenCalledOnce();
  });
});
