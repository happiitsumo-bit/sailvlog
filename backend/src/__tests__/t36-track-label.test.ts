// T-36 (Issue #36): PATCH /api/sessions/:id/tracks/:trackId（艇ラベルの更新）。
// 公開ダイアログでの実名露出防止（C-01）の窓口。バックエンド側の自動マスク・内容バリデーションは
// 行わない（対象外。ここで検証するのは既存の認可パターン・文字数境界のみ）。
import request from "supertest";
import { setupTestServer } from "./helpers/testServer";
import prisma from "../database";
import { validTrackPayload } from "./fixtures/trackPayloads";

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
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T36テストチーム" },
  });
}

async function addMember(userId: number, teamId: number, role: "member" | "admin" = "member") {
  return prisma.teamMember.create({ data: { userId, teamId, role } });
}

async function createSessionWithTrack(): Promise<{
  sessionId: number;
  teamId: number;
  trackId: number;
  uploader: { userId: number; token: string };
}> {
  const uploader = await registerUser("uploader");
  const team = await createTeam("s");
  await addMember(uploader.userId, team.id);

  const sessionRes = await request(getServer())
    .post("/api/sessions")
    .set("Authorization", `Bearer ${uploader.token}`)
    .send({
      title: "T36テストセッション",
      type: "practice",
      startedAt: "2026-07-24T05:00:00.000Z",
      durationSec: 7200,
      teamId: team.id,
    });
  const sessionId = sessionRes.body.session.id;

  const trackRes = await request(getServer())
    .post(`/api/sessions/${sessionId}/tracks`)
    .set("Authorization", `Bearer ${uploader.token}`)
    .send(validTrackPayload({ boatLabel: "boat1_clean" }));

  return { sessionId, teamId: team.id, trackId: trackRes.body.track.id, uploader };
}

describe("PATCH /api/sessions/:id/tracks/:trackId (T-36)", () => {
  test("TeamMemberが艇ラベルを更新できる", async () => {
    const { sessionId, trackId, uploader } = await createSessionWithTrack();

    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}/tracks/${trackId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ boatLabel: "デモ艇A" });

    expect(res.status).toBe(200);
    expect(res.body.track.boatLabel).toBe("デモ艇A");
    expect(res.body.track.gridJson).toBeUndefined();
    expect(res.body.track.rawGpx).toBeUndefined();
  });

  test("非TeamMemberは403", async () => {
    const { sessionId, trackId } = await createSessionWithTrack();
    const outsider = await registerUser("outsider");

    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}/tracks/${trackId}`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ boatLabel: "デモ艇A" });

    expect(res.status).toBe(403);
  });

  test("未認証は401", async () => {
    const { sessionId, trackId } = await createSessionWithTrack();
    const res = await request(getServer()).patch(`/api/sessions/${sessionId}/tracks/${trackId}`).send({
      boatLabel: "デモ艇A",
    });
    expect(res.status).toBe(401);
  });

  test("空文字は400", async () => {
    const { sessionId, trackId, uploader } = await createSessionWithTrack();
    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}/tracks/${trackId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ boatLabel: "   " });
    expect(res.status).toBe(400);
  });

  test("51文字以上は400（schema.prisma boatLabel @db.VarChar(50)）", async () => {
    const { sessionId, trackId, uploader } = await createSessionWithTrack();
    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}/tracks/${trackId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ boatLabel: "あ".repeat(51) });
    expect(res.status).toBe(400);
  });

  test("別セッションのtrackIdを指定すると404（セッション跨ぎの更新を防ぐ）", async () => {
    const a = await createSessionWithTrack();
    const b = await createSessionWithTrack();

    const res = await request(getServer())
      .patch(`/api/sessions/${a.sessionId}/tracks/${b.trackId}`)
      .set("Authorization", `Bearer ${a.uploader.token}`)
      .send({ boatLabel: "デモ艇A" });

    expect(res.status).toBe(404);
  });

  test("存在しないtrackIdは404", async () => {
    const { sessionId, uploader } = await createSessionWithTrack();
    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}/tracks/999999999`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ boatLabel: "デモ艇A" });
    expect(res.status).toBe(404);
  });
});
