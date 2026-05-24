import { describe, expect, it } from "vitest";
import { ChunkEditValidator } from "../../src/text/chunkEditValidator.js";

describe("ChunkEditValidator", () => {
  it("accepts edits whose from text exists in the source chunk", () => {
    const result = new ChunkEditValidator().validate("メツセージを読む。", [
      { from: "メツセージ", to: "メッセージ", reason: "OCR typo" }
    ]);

    expect(result.accepted).toEqual([
      { from: "メツセージ", to: "メッセージ", reason: "OCR typo" }
    ]);
    expect(result.rejected).toEqual([]);
  });

  it("rejects edits whose from text does not exist", () => {
    const result = new ChunkEditValidator().validate("本文です。", [
      { from: "存在しない", to: "本文" }
    ]);

    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]).toMatchObject({ code: "FROM_NOT_FOUND" });
  });

  it("rejects edits that add unseen numbers", () => {
    const result = new ChunkEditValidator().validate("彼は歳だった。", [
      { from: "歳", to: "14歳" }
    ]);

    expect(result.rejected[0]).toMatchObject({ code: "ADDS_UNSEEN_NUMBER" });
  });

  it("rejects edits that add omission markers", () => {
    const result = new ChunkEditValidator().validate("本文です。", [
      { from: "本文です。", to: "本文です。（以下略）" }
    ]);

    expect(result.rejected[0]).toMatchObject({ code: "ADDS_OMISSION_MARKER" });
  });

  it("rejects edits that create duplicated particles at the replacement boundary", () => {
    const result = new ChunkEditValidator().validate("以年も上場企業です。", [
      { from: "以年", to: "今年も" }
    ]);

    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]).toMatchObject({
      code: "CREATES_DUPLICATE_PARTICLE"
    });
  });

  it("rejects edits that expand short kana tokens", () => {
    const result = new ChunkEditValidator().validate("メツセを見た。", [
      { from: "メツセ", to: "メッセージ" }
    ]);

    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]).toMatchObject({
      code: "EXPANDS_SHORT_KANA_TOKEN"
    });
  });

  it("rejects short kana expansion inside longer edits", () => {
    const result = new ChunkEditValidator().validate(
      "メツセ(フエイスブツク)を見た。",
      [{ from: "メツセ(フエイスブツク)", to: "メッセージ(フェイスブック)" }]
    );

    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]).toMatchObject({
      code: "EXPANDS_SHORT_KANA_TOKEN"
    });
  });

  it("rejects edits with too much change", () => {
    const result = new ChunkEditValidator(0.1).validate("短い本文です。", [
      { from: "短い", to: "まったく別の長い説明" }
    ]);

    expect(result.rejected[0]).toMatchObject({ code: "TOO_MUCH_CHANGE" });
  });
});
