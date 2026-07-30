import { describe, expect, it } from "vitest";
import {
  canManageSession,
  isSummaryValid,
  remainingSummaryChars,
  visibilityChipLabel,
} from "../publish";

describe("T-32: canManageSession", () => {
  it("未ログイン(null)はfalse", () => {
    expect(canManageSession(1, null, true)).toBe(false);
  });
  it("uploader本人はtrue", () => {
    expect(canManageSession(5, 5, false)).toBe(true);
  });
  it("Team adminはtrue", () => {
    expect(canManageSession(5, 9, true)).toBe(true);
  });
  it("一般部員(非uploader・非admin)はfalse", () => {
    expect(canManageSession(5, 9, false)).toBe(false);
  });
});

describe("T-32: remainingSummaryChars / isSummaryValid", () => {
  it("残り文字数は max - length", () => {
    expect(remainingSummaryChars("abc", 400)).toBe(397);
  });
  it("空文字はinvalid", () => {
    expect(isSummaryValid("")).toBe(false);
  });
  it("空白のみはinvalid（trim後0文字）", () => {
    expect(isSummaryValid("   \n  ")).toBe(false);
  });
  it("400字ちょうどはvalid", () => {
    expect(isSummaryValid("あ".repeat(400))).toBe(true);
  });
  it("401字はinvalid", () => {
    expect(isSummaryValid("あ".repeat(401))).toBe(false);
  });
});

describe("T-32: visibilityChipLabel", () => {
  it("publicは「公開中」", () => {
    expect(visibilityChipLabel("public")).toBe("公開中");
  });
  it("unlistedは「リンク限定」", () => {
    expect(visibilityChipLabel("unlisted")).toBe("リンク限定");
  });
  it("teamはnull（非公開セッションには何も出さない）", () => {
    expect(visibilityChipLabel("team")).toBeNull();
  });
});
