// T-22 (implementer, 2026-08-03): Issue #22「ユーザー削除APIが無く、本番の検証用アカウントを
// 消せない」への実装検証。DELETE /api/users/me は自分自身のみを対象にした無効化＋匿名化。
//
// このファイルで固定したい回帰:
//   ①未認証は401
//   ②削除後はisActive=false・username/emailが匿名化され、旧メールでログインできなくなる
//   ③削除後は本人のTeamMemberが消え、他のメンバーには影響しない
//   ④唯一のadminであるチームがあれば409で拒否し、他のメンバーをadminにすれば削除できる
//   ⑤権限のないユーザーが他人を削除する経路が無い（/meは常に呼び出し本人のみが対象）
//   ⑥削除されたユーザーがuploadしたSession・投稿したAnnotationは残り、チームの記録が消えない
//   ⑦削除前に発行済みのJWTが、削除後は通用しない（レビュー指摘: 署名しか見ないと有効期限2時間の間
//     書き込みが通り続ける。authMiddlewareでisActiveを確認する形に変更したことの回帰）
import request from "supertest";
import { setupTestServer } from "./helpers/testServer";
import prisma from "../database";

const getServer = setupTestServer();
const PASSWORD = "password123";

async function registerUser(tag: string): Promise<{ userId: number; token: string; email: string }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `${unique}@example.com`;
  const res = await request(getServer())
    .post("/api/auth/register")
    .send({ username: `u${unique}`.slice(0, 30), email, password: PASSWORD });
  expect(res.status).toBe(201);
  return { userId: res.body.user.id, token: res.body.token, email };
}

async function createTeam(token: string, tag: string): Promise<{ slug: string; inviteCode: string; teamId: number }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await request(getServer())
    .post("/api/teams")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `T22テストチーム-${tag}`, slug: `t22-${unique}` });
  expect(res.status).toBe(201);
  return { slug: res.body.team.slug, inviteCode: res.body.inviteCode, teamId: res.body.team.id };
}

async function joinTeam(token: string, inviteCode: string): Promise<void> {
  const res = await request(getServer())
    .post("/api/teams/join")
    .set("Authorization", `Bearer ${token}`)
    .send({ inviteCode });
  expect(res.status).toBe(200);
}

describe("DELETE /api/users/me", () => {
  test("未認証は401", async () => {
    const res = await request(getServer()).delete("/api/users/me");
    expect(res.status).toBe(401);
  });

  test("チームに所属していないユーザーは自分を削除でき、以後ログインできなくなる", async () => {
    const user = await registerUser("solo-delete");

    const res = await request(getServer())
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${user.token}`);
    expect(res.status).toBe(204);

    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
    expect(dbUser?.isActive).toBe(false);
    expect(dbUser?.username).toBe(`deleted-user-${user.userId}`);
    expect(dbUser?.email).toBe(`deleted-user-${user.userId}@deleted.invalid`);

    const loginRes = await request(getServer())
      .post("/api/auth/login")
      .send({ email: user.email, password: PASSWORD });
    expect(loginRes.status).toBe(401);
  });

  test("唯一のadminであるチームがあると409。他のメンバーをadminにしてから削除できる", async () => {
    const admin = await registerUser("lastadmin-delete");
    const member = await registerUser("lastadmin-delete-member");
    const { slug, inviteCode } = await createTeam(admin.token, "lastadmin-delete");
    await joinTeam(member.token, inviteCode);

    const blocked = await request(getServer())
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.teams).toContain(slug);

    // 削除されていないことを確認(isActiveが変わっていない)
    const stillActive = await prisma.user.findUnique({ where: { id: admin.userId } });
    expect(stillActive?.isActive).toBe(true);

    const promote = await request(getServer())
      .patch(`/api/teams/${slug}/members/${member.userId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "admin" });
    expect(promote.status).toBe(200);

    const allowed = await request(getServer())
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(allowed.status).toBe(204);
  });

  test("削除すると自分のTeamMemberは消えるが、他のメンバーには影響しない", async () => {
    const admin = await registerUser("member-cleanup-admin");
    const member = await registerUser("member-cleanup-member");
    const { slug, inviteCode, teamId } = await createTeam(admin.token, "member-cleanup");
    await joinTeam(member.token, inviteCode);

    // memberをadminに昇格しておけば、両者が抜けても最後のadminが残る心配なく検証できる
    await request(getServer())
      .patch(`/api/teams/${slug}/members/${member.userId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "admin" });

    const res = await request(getServer())
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${member.token}`);
    expect(res.status).toBe(204);

    const remainingMembership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: member.userId, teamId } },
    });
    expect(remainingMembership).toBeNull();

    // adminは無関係な他人の削除に巻き込まれていない
    const adminRow = await prisma.user.findUnique({ where: { id: admin.userId } });
    expect(adminRow?.isActive).toBe(true);
    const adminMembership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: admin.userId, teamId } },
    });
    expect(adminMembership).not.toBeNull();
  });

  test("削除されたユーザーがuploadしたSession・投稿したAnnotationは残り、チームの記録が消えない", async () => {
    const admin = await registerUser("history-keep-admin");
    const uploader = await registerUser("history-keep-uploader");
    const { slug, inviteCode, teamId } = await createTeam(admin.token, "history-keep");
    await joinTeam(uploader.token, inviteCode);

    const sessionRes = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({
        title: "履歴保持確認セッション",
        type: "practice",
        startedAt: "2026-07-24T05:00:00.000Z",
        durationSec: 3600,
        teamId,
      });
    expect(sessionRes.status).toBe(201);
    const sessionId = sessionRes.body.session.id as number;

    const annotationRes = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 10, body: "履歴保持確認メモ" });
    expect(annotationRes.status).toBe(201);
    const annotationId = annotationRes.body.annotation.id as number;

    const deleteRes = await request(getServer())
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(deleteRes.status).toBe(204);

    const sessionAfter = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(sessionAfter).not.toBeNull();
    expect(sessionAfter?.uploaderId).toBe(uploader.userId);

    const annotationAfter = await prisma.annotation.findUnique({ where: { id: annotationId } });
    expect(annotationAfter).not.toBeNull();
    expect(annotationAfter?.authorId).toBe(uploader.userId);

    // 部内から見てもセッション自体は引き続き取得できる(adminとして確認)
    const detail = await request(getServer())
      .get(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(detail.status).toBe(200);
  });
  // ⑦ レビュー指摘の回帰: ソフトデリートではUser行が残るため、署名検証だけの認証だと
  // 削除直前のJWT（有効期限2時間）でチーム作成のような書き込みまで通ってしまっていた。
  test("削除前に発行されたトークンは、削除後は認証・書き込みの両方で通らない", async () => {
    const victim = await registerUser("t22-revoked");
    const tokenIssuedBeforeDelete = victim.token;

    // 削除前は通ること（テスト自体が無意味になっていないことの確認）
    const beforeRes = await request(getServer())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${tokenIssuedBeforeDelete}`);
    expect(beforeRes.status).toBe(200);

    const deleteRes = await request(getServer())
      .delete("/api/users/me")
      .set("Authorization", `Bearer ${tokenIssuedBeforeDelete}`);
    expect(deleteRes.status).toBe(204);

    // 読み取りが塞がれている
    const readAfter = await request(getServer())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${tokenIssuedBeforeDelete}`);
    expect(readAfter.status).toBe(401);

    // 書き込み（チーム作成）も塞がれている ＝ 指摘された経路そのもの
    const writeAfter = await request(getServer())
      .post("/api/teams")
      .set("Authorization", `Bearer ${tokenIssuedBeforeDelete}`)
      .send({ name: "削除済みユーザーが作れてはいけないチーム" });
    expect(writeAfter.status).toBe(401);

    const created = await prisma.team.findFirst({
      where: { name: "削除済みユーザーが作れてはいけないチーム" },
    });
    expect(created).toBeNull();
  });
});
