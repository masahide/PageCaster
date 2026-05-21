import { describe, expect, it } from "vitest";
import { PageChangeWatcher } from "../../src/capture/waitForPageChange.js";
import { ImageHasher } from "../../src/capture/hashImage.js";
import { AppError } from "../../src/errors.js";

describe("PageChangeWatcher", () => {
  it("returns the new hash when screenshot content changes", async () => {
    const hasher = new ImageHasher();
    const previousHash = hasher.sha256(Buffer.from("before"));
    const buffers = [
      Buffer.from("before"),
      Buffer.from("after"),
      Buffer.from("after")
    ];
    const watcher = new PageChangeWatcher({
      timeoutMs: 1000,
      pollMs: 1,
      hasher,
      captureBuffer: async () => buffers.shift() ?? Buffer.from("after"),
      sleep: async () => undefined
    });

    await expect(watcher.waitForChange(previousHash)).resolves.toBe(
      hasher.sha256(Buffer.from("after"))
    );
  });

  it("throws PAGE_CHANGE_TIMEOUT when content does not change", async () => {
    const hasher = new ImageHasher();
    const previousHash = hasher.sha256(Buffer.from("same"));
    const watcher = new PageChangeWatcher({
      timeoutMs: 0,
      pollMs: 1,
      hasher,
      captureBuffer: async () => Buffer.from("same"),
      sleep: async () => undefined
    });

    await expect(watcher.waitForChange(previousHash, 2)).rejects.toMatchObject({
      code: "PAGE_CHANGE_TIMEOUT",
      pageIndex: 2
    } satisfies Partial<AppError>);
  });

  it("does not accept a transient changed frame", async () => {
    const hasher = new ImageHasher();
    const previousHash = hasher.sha256(Buffer.from("same"));
    const buffers = [Buffer.from("flash"), Buffer.from("same")];
    const watcher = new PageChangeWatcher({
      timeoutMs: 0,
      pollMs: 1,
      hasher,
      captureBuffer: async () => buffers.shift() ?? Buffer.from("same"),
      sleep: async () => undefined
    });

    await expect(watcher.waitForChange(previousHash)).rejects.toMatchObject({
      code: "PAGE_CHANGE_TIMEOUT"
    });
  });
});
