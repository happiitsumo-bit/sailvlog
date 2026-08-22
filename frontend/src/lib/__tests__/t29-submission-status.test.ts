// Issue #29: 提出状況の可視化。純関数 computeSubmissionStatus のユニットテスト。
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { computeSubmissionStatus } from "../submissionStatus";
import { TeamMember } from "@/types";

function member(userId: number, username: string): TeamMember {
  return {
    id: userId,
    role: "member",
    joinedAt: "2026-08-01T00:00:00.000Z",
    user: { id: userId, username, avatarUrl: undefined, specialty: undefined, experienceYears: undefined, boatType: undefined },
  };
}

describe("computeSubmissionStatus（Issue #29）", () => {
  it("誰も提出していなければ全員がmissing", () => {
    const members = [member(1, "alice"), member(2, "bob")];
    const status = computeSubmissionStatus(members, []);
    expect(status.submittedCount).toBe(0);
    expect(status.totalCount).toBe(2);
    expect(status.missingMembers.map((m) => m.user.username)).toEqual(["alice", "bob"]);
  });

  it("提出したメンバーはmissingから外れる", () => {
    const members = [member(1, "alice"), member(2, "bob"), member(3, "carol")];
    const status = computeSubmissionStatus(members, [2]);
    expect(status.submittedCount).toBe(1);
    expect(status.missingMembers.map((m) => m.user.username)).toEqual(["alice", "carol"]);
  });

  it("全員提出済みならmissingは空", () => {
    const members = [member(1, "alice"), member(2, "bob")];
    const status = computeSubmissionStatus(members, [1, 2]);
    expect(status.missingMembers).toEqual([]);
    expect(status.submittedCount).toBe(2);
  });

  it("同じメンバーが複数トラックを出していても二重カウントしない", () => {
    const members = [member(1, "alice"), member(2, "bob")];
    const status = computeSubmissionStatus(members, [1, 1, 1]);
    expect(status.submittedCount).toBe(1);
  });

  it("uploaderIdがnull/undefined（既存行）は提出者不明として扱い、誰の提出にもならない", () => {
    const members = [member(1, "alice")];
    const status = computeSubmissionStatus(members, [null, undefined]);
    expect(status.submittedCount).toBe(0);
    expect(status.missingMembers.map((m) => m.user.username)).toEqual(["alice"]);
  });

  it("チームメンバーが0人ならtotalCount=0・missingも空", () => {
    const status = computeSubmissionStatus([], [1, 2]);
    expect(status.totalCount).toBe(0);
    expect(status.submittedCount).toBe(0);
    expect(status.missingMembers).toEqual([]);
  });
});

const sessionDetailPage = readFileSync(join(__dirname, "../../app/sessions/[id]/page.tsx"), "utf-8");
const sessionsListPage = readFileSync(join(__dirname, "../../app/sessions/page.tsx"), "utf-8");

describe("Issue #29-2: 自分が出す導線の文言（セッション詳細）", () => {
  it('「航跡を追加」ではなく「自分の航跡を出す」に改名されている', () => {
    expect(sessionDetailPage).toContain("自分の航跡を出す");
    expect(sessionDetailPage).not.toContain(">航跡を追加<");
  });
});

describe("Issue #29-3: セッション一覧の未提出バッジ", () => {
  it("mySubmitted===falseのとき「未提出」バッジを出す分岐がある", () => {
    expect(sessionsListPage).toContain("!s.mySubmitted");
    expect(sessionsListPage).toContain("未提出");
  });
});
