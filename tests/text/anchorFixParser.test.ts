import { describe, expect, it } from "vitest";
import { AnchorFixParser, parseAnchorFixContent } from "../../src/text/anchorFixParser.js";

describe("AnchorFixParser", () => {
  it("parses NO_FIX as no fixes", () => {
    expect(parseAnchorFixContent("NO_FIX")).toEqual([]);
  });

  it("parses a single fix", () => {
    expect(
      parseAnchorFixContent(
        "<fix><anchor>広報担当者から来たメツセ</anchor><target>メツセ</target><to>メッセ</to></fix>"
      )
    ).toEqual([
      {
        anchor: "広報担当者から来たメツセ",
        target: "メツセ",
        to: "メッセ"
      }
    ]);
  });

  it("parses multiple fixes in order", () => {
    expect(
      new AnchorFixParser().parse(
        [
          "<fix><anchor>フエイスブツクを開く</anchor><target>フエイスブツク</target><to>フェイスブック</to></fix>",
          "<fix><anchor>ネツトの記事</anchor><target>ネツト</target><to>ネット</to></fix>"
        ].join("\n")
      )
    ).toEqual([
      { anchor: "フエイスブツクを開く", target: "フエイスブツク", to: "フェイスブック" },
      { anchor: "ネツトの記事", target: "ネツト", to: "ネット" }
    ]);
  });

  it("rejects missing tags", () => {
    expect(() =>
      parseAnchorFixContent("<fix><anchor>メツセ</anchor><to>メッセ</to></fix>")
    ).toThrow(/LLM_RESPONSE_INVALID/);
  });

  it("rejects markdown fences and explanations", () => {
    expect(() =>
      parseAnchorFixContent(
        "```xml\n<fix><anchor>メツセ</anchor><target>メツセ</target><to>メッセ</to></fix>\n```"
      )
    ).toThrow(/LLM_RESPONSE_INVALID/);

    expect(() =>
      parseAnchorFixContent(
        "修正候補です。\n<fix><anchor>メツセ</anchor><target>メツセ</target><to>メッセ</to></fix>"
      )
    ).toThrow(/LLM_RESPONSE_INVALID/);
  });
});
