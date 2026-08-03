// Issue #42（P10・UX Major: 動線の3件）の回帰テスト。
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildLoginRedirectUrl, isSafeNextPath, resolveLoginDestination } from "../loginRedirect";
import { LAST_TEAM_ID_STORAGE_KEY, readLastTeamId, resolveAutoSelectedTeamId, writeLastTeamId } from "../teamSelection";

const sessionDetailPage = readFileSync(
  join(__dirname, "../../app/sessions/[id]/page.tsx"),
  "utf-8"
);

describe("M-4: buildLoginRedirectUrl / isSafeNextPath / resolveLoginDestination（Issue #42）", () => {
  it("パスのみから next 付きの/loginURLを組み立てる", () => {
    expect(buildLoginRedirectUrl("/sessions/2")).toBe("/login?next=%2Fsessions%2F2");
  });

  it("検索文字列込みでも組み立てられる（?t=&boats=等の深いリンクを保持）", () => {
    expect(buildLoginRedirectUrl("/sessions/2", "?t=30&boats=1,2")).toBe(
      "/login?next=" + encodeURIComponent("/sessions/2?t=30&boats=1,2")
    );
  });

  it("相対パス（\"/\"始まり）は安全と判定する", () => {
    expect(isSafeNextPath("/sessions/2")).toBe(true);
    expect(isSafeNextPath("/")).toBe(true);
  });

  it("プロトコル相対URL（\"//evil.com\"）はオープンリダイレクトとして拒否する", () => {
    expect(isSafeNextPath("//evil.com")).toBe(false);
  });

  it("絶対URL（\"https://evil.com\"）は拒否する", () => {
    expect(isSafeNextPath("https://evil.com")).toBe(false);
  });

  it("バックスラッシュ経由の回避（\"/\\\\evil.com\"）も拒否する", () => {
    expect(isSafeNextPath("/\\evil.com")).toBe(false);
  });

  it("null/undefined/空文字は拒否する", () => {
    expect(isSafeNextPath(null)).toBe(false);
    expect(isSafeNextPath(undefined)).toBe(false);
    expect(isSafeNextPath("")).toBe(false);
  });

  it("resolveLoginDestination: 安全なnextがあればそれを返す", () => {
    expect(resolveLoginDestination("/sessions/2?t=30")).toBe("/sessions/2?t=30");
  });

  it("resolveLoginDestination: 安全でない/無いnextは既定の/sessionsを返す", () => {
    expect(resolveLoginDestination("//evil.com")).toBe("/sessions");
    expect(resolveLoginDestination(null)).toBe("/sessions");
  });
});

describe("M-3: resolveAutoSelectedTeamId（Issue #42）", () => {
  it("直近選択(lastTeamId)が現メンバーシップに残っていればそれを優先する", () => {
    expect(resolveAutoSelectedTeamId([3, 5, 9], 5)).toBe(5);
  });

  it("直近選択が現メンバーシップから外れていれば無視する", () => {
    expect(resolveAutoSelectedTeamId([3, 9], 5)).toBe(null);
  });

  it("直近選択が無く、所属チームが1件だけならそれを自動選択する", () => {
    expect(resolveAutoSelectedTeamId([7], null)).toBe(7);
  });

  it("直近選択が無く、所属チームが複数あれば自動選択しない（本人に選ばせる）", () => {
    expect(resolveAutoSelectedTeamId([3, 5], null)).toBe(null);
  });

  it("所属チームが0件ならnull", () => {
    expect(resolveAutoSelectedTeamId([], null)).toBe(null);
  });
});

describe("M-3: readLastTeamId / writeLastTeamId の永続化（Issue #42）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("初期状態はnull", () => {
    expect(readLastTeamId()).toBe(null);
  });

  it("write後にreadで同じ値が戻る", () => {
    writeLastTeamId(12);
    expect(readLastTeamId()).toBe(12);
    expect(window.localStorage.getItem(LAST_TEAM_ID_STORAGE_KEY)).toBe("12");
  });

  it("不正な値が入っていてもクラッシュせずnullを返す", () => {
    window.localStorage.setItem(LAST_TEAM_ID_STORAGE_KEY, "not-a-number");
    expect(readLastTeamId()).toBe(null);
  });
});

describe("M-9: 公開リンクと部内リンクのラベルが区別できる（Issue #42）", () => {
  it('公開ボタンは「公開リンク（部外可）をコピー」に改名されている', () => {
    expect(sessionDetailPage).toContain("公開リンク（部外可）をコピー");
    expect(sessionDetailPage).not.toContain('"公開URLをコピー"');
  });

  it('部内共有ボタンは「部内リンクをコピー」に改名されている', () => {
    expect(sessionDetailPage).toContain("部内リンクをコピー");
    expect(sessionDetailPage).not.toContain('"共有URLをコピー"');
  });

  it("未公開時に「部内のみ」バッジを出す分岐がある", () => {
    expect(sessionDetailPage).toContain("部内のみ");
  });
});
