// T-30: 公開昇格のスキーマ＋API（POST /api/sessions/:id/publish, POST /api/sessions/:id/unpublish）
// のsupertest。SPEC-share1-phase1.md §5.1 / ARCH.md §4 の検証欄を網羅する。
import request from "supertest";
import { setupTestServer } from "./helpers/testServer";
import prisma from "../database";

const getServer = setupTestServer();

async function registerUser(tag: string): Promise<{ userId: number; token: string }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await request(getServer())
    .post("/api/auth/register")
    .send({ username: `u${unique}`.slice(0, 30), email: `${unique}@example.com`, password: "password123" });
  return { userId: res.body.user.id, token: res.body.token };
}

async function createTeam(tag: string) {
  return prisma.team.create({
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T30テストチーム" },
  });
}

async function addMember(userId: number, teamId: number, role: "member" | "admin" = "member") {
  return prisma.teamMember.create({ data: { userId, teamId, role } });
}

async function createSessionAsMember(): Promise<{
  sessionId: number;
  teamId: number;
  uploader: { userId: number; token: string };
  durationSec: number;
}> {
  const uploader = await registerUser("uploader");
  const team = await createTeam("s");
  await addMember(uploader.userId, team.id);
  const res = await request(getServer())
    .post("/api/sessions")
    .set("Authorization", `Bearer ${uploader.token}`)
    .send({ title: "第1回練習", type: "practice", startedAt: "2026-07-24T05:00:00.000Z", durationSec: 3600, teamId: team.id });
  return { sessionId: res.body.session.id, teamId: team.id, uploader, durationSec: res.body.session.durationSec };
}

async function addAnnotation(sessionId: number, token: string, tSec = 10) {
  const res = await request(getServer())
    .post(`/api/sessions/${sessionId}/annotations`)
    .set("Authorization", `Bearer ${token}`)
    .send({ tSec, body: "テスト注釈" });
  return res.body.annotation.id as number;
}

describe("POST /api/sessions/:id/publish (T-30)", () => {
  test("正常系(unlisted): 201系(200)でpublicSlug/publicUrl/visibility/publishedAtが返る", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "上マーク回航後の展開が遅れた", publicAnnotationIds: [] });

    expect(res.status).toBe(200);
    expect(typeof res.body.publicSlug).toBe("string");
    expect(res.body.publicSlug.length).toBeGreaterThan(0);
    expect(res.body.publicUrl).toContain(res.body.publicSlug);
    expect(res.body.visibility).toBe("unlisted");
    expect(res.body.publishedAt).not.toBeNull();

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(session?.publicSlug).toBe(res.body.publicSlug);
    expect(session?.learningSummary).toBe("上マーク回航後の展開が遅れた");
  });

  test("正常系(public): visibility=publicで200", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "public", learningSummary: "学びの要約テキスト" });

    expect(res.status).toBe(200);
    expect(res.body.visibility).toBe("public");
  });

  test("learningSummaryが空文字は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "" });
    expect(res.status).toBe(400);
  });

  test("learningSummaryが401字以上は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "あ".repeat(401) });
    expect(res.status).toBe(400);
  });

  test("learningSummaryが400字＋末尾空白1つは200（R-08: フロントtrim後判定とサーバ側判定を一致させる）", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: `${"あ".repeat(400)} ` });
    expect(res.status).toBe(200);
  });

  test("visibilityが不正な値は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "team", learningSummary: "学びの要約" });
    expect(res.status).toBe(400);
  });

  test("他セッションの注釈IDを混ぜたら400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const other = await createSessionAsMember();
    const otherAnnotationId = await addAnnotation(other.sessionId, other.uploader.token);

    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "学びの要約", publicAnnotationIds: [otherAnnotationId] });
    expect(res.status).toBe(400);
  });

  test("非uploader・非adminは403", async () => {
    const { sessionId, teamId } = await createSessionAsMember();
    const other = await registerUser("otherMember");
    await addMember(other.userId, teamId, "member");

    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ visibility: "unlisted", learningSummary: "学びの要約" });
    expect(res.status).toBe(403);
  });

  test("Team adminは公開できる(200)", async () => {
    const { sessionId, teamId } = await createSessionAsMember();
    const admin = await registerUser("admin");
    await addMember(admin.userId, teamId, "admin");

    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ visibility: "unlisted", learningSummary: "学びの要約" });
    expect(res.status).toBe(200);
  });

  test("選択した注釈だけisPublic=trueになり、選択外はfalseのまま", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const idA = await addAnnotation(sessionId, uploader.token, 5);
    const idB = await addAnnotation(sessionId, uploader.token, 15);

    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "学びの要約", publicAnnotationIds: [idA] });
    expect(res.status).toBe(200);

    const a = await prisma.annotation.findUnique({ where: { id: idA } });
    const b = await prisma.annotation.findUnique({ where: { id: idB } });
    expect(a?.isPublic).toBe(true);
    expect(b?.isPublic).toBe(false);
  });

  test("未認証(JWTなし)は401", async () => {
    const { sessionId } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .send({ visibility: "unlisted", learningSummary: "学びの要約" });
    expect(res.status).toBe(401);
  });

  test("存在しないセッションIDは404", async () => {
    const { uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/999999/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "学びの要約" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/sessions/:id/unpublish (T-30)", () => {
  test("unpublish後にpublicSlugがnullになりvisibilityがteamに戻る", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "学びの要約" });

    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/unpublish`)
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(res.status).toBe(200);
    expect(res.body.visibility).toBe("team");

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(session?.publicSlug).toBeNull();
    expect(session?.visibility).toBe("team");
  });

  test("再公開すると前と異なるスラッグが発行される", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const first = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "学びの要約1" });

    await request(getServer())
      .post(`/api/sessions/${sessionId}/unpublish`)
      .set("Authorization", `Bearer ${uploader.token}`);

    const second = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "public", learningSummary: "学びの要約2" });

    expect(second.body.publicSlug).not.toBe(first.body.publicSlug);
  });

  test("非uploader・非adminのunpublishは403", async () => {
    const { sessionId, uploader, teamId } = await createSessionAsMember();
    await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "学びの要約" });

    const other = await registerUser("otherMember2");
    await addMember(other.userId, teamId, "member");
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/unpublish`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(res.status).toBe(403);
  });
});
