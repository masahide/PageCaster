import { describe, expect, it } from "vitest";
import { AnchorFixValidator } from "../../src/text/anchorFixValidator.js";

const validator = new AnchorFixValidator({
  maxAnchorChars: 20,
  maxFixesPerChunk: 5,
  maxFixRatio: 0.25
});

describe("AnchorFixValidator", () => {
  it("accepts a fix whose anchor exists and contains target", () => {
    const result = validator.validate("広報担当者から来たメツセを読んだ。", [
      { anchor: "広報担当者から来たメツセ", target: "メツセ", to: "メッセ" }
    ]);

    expect(result.accepted).toEqual([
      { anchor: "広報担当者から来たメツセ", target: "メツセ", to: "メッセ" }
    ]);
    expect(result.rejected).toEqual([]);
  });

  it("rejects a fix whose anchor is not found", () => {
    const result = validator.validate("本文です。", [
      { anchor: "存在しないメツセ", target: "メツセ", to: "メッセ" }
    ]);

    expect(result.rejected[0]?.code).toBe("ANCHOR_NOT_FOUND");
  });

  it("rejects a fix whose anchor is not unique", () => {
    const result = validator.validate("メツセを見た。メツセを閉じた。", [
      { anchor: "メツセ", target: "メツセ", to: "メッセ" }
    ]);

    expect(result.rejected[0]?.code).toBe("ANCHOR_NOT_UNIQUE");
  });

  it("rejects a fix whose target is not inside the anchor", () => {
    const result = validator.validate("広報担当者から来たメツセを読んだ。", [
      { anchor: "広報担当者から来たメツセ", target: "メール", to: "メッセ" }
    ]);

    expect(result.rejected[0]?.code).toBe("TARGET_NOT_FOUND_IN_ANCHOR");
  });

  it("rejects a fix whose anchor is too long", () => {
    const result = validator.validate("これはとても長いanchorを含む本文です。", [
      {
        anchor: "これはとても長いanchorを含む本文です",
        target: "anchor",
        to: "アンカー"
      }
    ]);

    expect(result.rejected[0]?.code).toBe("ANCHOR_TOO_LONG");
  });

  it("rejects a fix that adds unseen numbers", () => {
    const result = validator.validate("彼は歳だった。", [
      { anchor: "彼は歳だった", target: "歳", to: "30歳" }
    ]);

    expect(result.rejected[0]?.code).toBe("ADDS_UNSEEN_NUMBER");
  });

  it("rejects a fix that adds omission markers", () => {
    const result = validator.validate("本文です。", [
      { anchor: "本文です", target: "本文", to: "本文（以下略）" }
    ]);

    expect(result.rejected[0]?.code).toBe("ADDS_OMISSION_MARKER");
  });

  it("rejects a fix that changes too much text", () => {
    const result = new AnchorFixValidator({
      maxAnchorChars: 20,
      maxFixesPerChunk: 5,
      maxFixRatio: 0.1
    }).validate("メツセを見た。", [
      { anchor: "メツセを見た", target: "メツセ", to: "メッセージ本文を推測して追加" }
    ]);

    expect(result.rejected[0]?.code).toBe("TOO_MUCH_CHANGE");
  });
});
