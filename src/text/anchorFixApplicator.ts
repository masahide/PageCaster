import type { AnchorFix } from "../types.js";

export type AnchorFixApplyResult = {
  text: string;
  applied: boolean;
  fallbackReason?: "TOO_LONG_AFTER_FIX";
};

export class AnchorFixApplicator {
  constructor(private readonly maxChars: number) {}

  apply(chunkText: string, fixes: AnchorFix[]): AnchorFixApplyResult {
    let nextText = chunkText;

    for (const fix of fixes) {
      nextText = replaceTargetInsideAnchor(nextText, fix);
    }

    if (nextText.length > this.maxChars) {
      return {
        text: chunkText,
        applied: false,
        fallbackReason: "TOO_LONG_AFTER_FIX"
      };
    }

    return {
      text: nextText,
      applied: nextText !== chunkText
    };
  }
}

function replaceTargetInsideAnchor(text: string, fix: AnchorFix): string {
  const anchorIndex = text.indexOf(fix.anchor);
  if (anchorIndex < 0) {
    return text;
  }

  const targetIndexInAnchor = fix.anchor.indexOf(fix.target);
  if (targetIndexInAnchor < 0) {
    return text;
  }

  const targetIndex = anchorIndex + targetIndexInAnchor;
  return `${text.slice(0, targetIndex)}${fix.to}${text.slice(targetIndex + fix.target.length)}`;
}
