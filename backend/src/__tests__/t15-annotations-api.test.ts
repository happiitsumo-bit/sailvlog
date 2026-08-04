// T-15: タイムライン注釈API（POST /api/sessions/:id/annotations, PATCH/DELETE /api/annotations/:id）
// のsupertest。fixtures/trackPayloads.ts の annotation系ビルダー（qa-engineer用意）を使う。
import request from "supertest";
import { setupTestServer } from "./helpers/testServer";
import prisma from "../database";
import {
  validAnnotationPayload,
  annotationWithTSecOutOfRange,
  annotationWithBodyTooLong,
} from "./fixtures/trackPayloads";

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
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T15テストチーム" },
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
    .send({ title: "第1回練習", type: "practice", startedAt: "2026-07-24T05:00:00.000Z", durationSec: 7200, teamId: team.id });
  return { sessionId: res.body.session.id, teamId: team.id, uploader, durationSec: res.body.session.durationSec };
}

describe("POST /api/sessions/:id/annotations (T-15)", () => {
  test("正常なtSec/bodyは201", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(validAnnotationPayload());

    expect(res.status).toBe(201);
    expect(res.body.annotation.body).toBe("ここでタック");
    expect(res.body.annotation.tSec).toBe(10);
    expect(res.body.annotation.authorId).toBe(uploader.userId);
  });

  test("tSecがdurationSec範囲外は400", async () => {
    const { sessionId, uploader, durationSec } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(annotationWithTSecOutOfRange(durationSec));
    expect(res.status).toBe(400);
  });

  test("bodyが2000字超は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(annotationWithBodyTooLong());
    expect(res.status).toBe(400);
  });

  test("非TeamMemberのPOSTは403", async () => {
    const { sessionId } = await createSessionAsMember();
    const outsider = await registerUser("outsider");
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .send(validAnnotationPayload());
    expect(res.status).toBe(403);
  });

  test("未認証(JWTなし)は401", async () => {
    const { sessionId } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .send(validAnnotationPayload());
    expect(res.status).toBe(401);
  });

  test("trackIdが他セッションのTrackを指すと400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const other = await createSessionAsMember();
    const otherTrack = await prisma.track.create({
      data: {
        sessionId: other.sessionId,
        boatLabel: "よそのセッションの艇",
        startSec: 0,
        pointCount: 3,
        gridJson: { lat: [35, 35, 35], lon: [139, 139, 139], gaps: [] },
        rawGpx: "<gpx></gpx>",
      },
    });

    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(validAnnotationPayload({ trackId: otherTrack.id }));
    expect(res.status).toBe(400);
  });
});

describe("PATCH/DELETE /api/annotations/:id (T-15)", () => {
  async function createAnnotation() {
    const ctx = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${ctx.sessionId}/annotations`)
      .set("Authorization", `Bearer ${ctx.uploader.token}`)
      .send(validAnnotationPayload());
    return { ...ctx, annotationId: res.body.annotation.id as number };
  }

  test("author本人によるPATCHは200でbodyが更新される", async () => {
    const { annotationId, uploader } = await createAnnotation();
    const res = await request(getServer())
      .patch(`/api/annotations/${annotationId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ body: "修正後のメモ" });

    expect(res.status).toBe(200);
    expect(res.body.annotation.body).toBe("修正後のメモ");
  });

  test("Team adminによるPATCHは200", async () => {
    const { annotationId, teamId } = await createAnnotation();
    const admin = await registerUser("admin");
    await addMember(admin.userId, teamId, "admin");

    const res = await request(getServer())
      .patch(`/api/annotations/${annotationId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ body: "管理者による修正" });
    expect(res.status).toBe(200);
  });

  test("author本人でもTeam adminでもない同TeamMemberによるPATCHは403", async () => {
    const { annotationId, teamId } = await createAnnotation();
    const other = await registerUser("otherMember");
    await addMember(other.userId, teamId, "member");

    const res = await request(getServer())
      .patch(`/api/annotations/${annotationId}`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ body: "他人による修正" });
    expect(res.status).toBe(403);
  });

  test("author本人によるDELETEは204", async () => {
    const { annotationId, uploader } = await createAnnotation();
    const res = await request(getServer())
      .delete(`/api/annotations/${annotationId}`)
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(res.status).toBe(204);

    const remaining = await prisma.annotation.findUnique({ where: { id: annotationId } });
    expect(remaining).toBeNull();
  });

  test("author本人でもTeam adminでもない同TeamMemberによるDELETEは403", async () => {
    const { annotationId, teamId } = await createAnnotation();
    const other = await registerUser("otherMember2");
    await addMember(other.userId, teamId, "member");

    const res = await request(getServer())
      .delete(`/api/annotations/${annotationId}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(res.status).toBe(403);
  });

  test("存在しない注釈IDのPATCHは404", async () => {
    const { uploader } = await createAnnotation();
    const res = await request(getServer())
      .patch(`/api/annotations/999999`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ body: "x" });
    expect(res.status).toBe(404);
  });

  // C-02回帰（Issue #39）: isAuthorOrTeamAdminはauthor本人でも即許可せず、
  // 現在もそのチームのTeamMemberであることを確認する。脱退・除名後は403になる。
  test("脱退・除名後は本人でもPATCHできない（403）", async () => {
    const { annotationId, uploader, teamId } = await createAnnotation();

    await prisma.teamMember.delete({ where: { userId_teamId: { userId: uploader.userId, teamId } } });

    const res = await request(getServer())
      .patch(`/api/annotations/${annotationId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ body: "除名後の書き換え" });
    expect(res.status).toBe(403);
  });

  test("脱退・除名後は本人でもDELETEできない（403）", async () => {
    const { annotationId, uploader, teamId } = await createAnnotation();

    await prisma.teamMember.delete({ where: { userId_teamId: { userId: uploader.userId, teamId } } });

    const res = await request(getServer())
      .delete(`/api/annotations/${annotationId}`)
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(res.status).toBe(403);

    const remaining = await prisma.annotation.findUnique({ where: { id: annotationId } });
    expect(remaining).not.toBeNull();
  });
});
