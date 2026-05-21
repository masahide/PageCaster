import { describe, expect, it } from "vitest";
import { ImageHasher } from "../../src/capture/hashImage.js";

describe("ImageHasher", () => {
  it("calculates sha256 for a buffer", () => {
    const hash = new ImageHasher().sha256(Buffer.from("pagecaster"));

    expect(hash).toBe(
      "56af9ec8afb25df7bb8d64ccf3742af1f3642fb103115dc7125607e5ae193ec6"
    );
  });
});
