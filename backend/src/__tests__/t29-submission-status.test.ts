// Issue #29: 提出状況の可視化。誰が航跡を出したか（Track.uploaderId）を記録し、
// GET /api/sessions/:id（uploaderId込みのtracks）と GET /api/sessions?teamId=（mySubmitted）
// で使えるようにする土台のAPI契約テスト。helpers/testServer.ts使用（AGENTS.md制約6）。
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
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T29テストチーム" },
  });
}

async function addMember(userId: number, teamId: number) {
  return prisma.teamMember.create({ data: { userId, teamId, role: "member" } });
}

function validTrackBody(overrides: Record<string, unknown> = {}) {
  return {
    boatLabel: "テスト艇",
    startSec: 0,
    pointCount: 2,
    gridJson: { lat: [35.0, 35.001], lon: [139.0, 139.001], gaps: [] },
    rawGpx: "<gpx></gpx>",
    ...overrides,
  };
}

describe("Issue #29: POST /api/sessions/:id/tracks がuploaderIdを記録する", () => {
  test("トラックを追加した本人のuserIdがuploaderIdになる", async () => {
    const uploader = await registerUser("t29a");
    const team = await createTeam("t29a");
    await addMember(uploader.userId, team.id);

    const sessionRes = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ title: "練習", type: "practice", startedAt: "2026-08-01T05:00:00.000Z", durationSec: 3600, teamId: team.id });
    const sessionId = sessionRes.body.session.id;

    const trackRes = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(validTrackBody());
    expect(trackRes.status).toBe(201);

    const detailRes = await request(getServer())
      .get(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.tracks).toHaveLength(1);
    expect(detailRes.body.tracks[0].uploaderId).toBe(uploader.userId);
  });

  test("別のチームメンバーが追加したtrackは、そのメンバーのuploaderIdになる（他人のものと混同しない）", async () => {
    const sessionCreator = await registerUser("t29b1");
    const otherMember = await registerUser("t29b2");
    const team = await createTeam("t29b");
    await addMember(sessionCreator.userId, team.id);
    await addMember(otherMember.userId, team.id);

    const sessionRes = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${sessionCreator.token}`)
      .send({ title: "練習", type: "practice", startedAt: "2026-08-01T05:00:00.000Z", durationSec: 3600, teamId: team.id });
    const sessionId = sessionRes.body.session.id;

    await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${otherMember.token}`)
      .send(validTrackBody({ boatLabel: "他メンバー艇" }));

    const detailRes = await request(getServer())
      .get(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${sessionCreator.token}`);
    expect(detailRes.body.tracks[0].uploaderId).toBe(otherMember.userId);
  });
});

describe("Issue #29: GET /api/sessions?teamId= がmySubmittedを返す", () => {
  test("自分が航跡を出していればmySubmitted=true、出していなければfalse", async () => {
    const submitter = await registerUser("t29c1");
    const nonSubmitter = await registerUser("t29c2");
    const team = await createTeam("t29c");
    await addMember(submitter.userId, team.id);
    await addMember(nonSubmitter.userId, team.id);

    const sessionRes = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${submitter.token}`)
      .send({ title: "練習", type: "practice", startedAt: "2026-08-01T05:00:00.000Z", durationSec: 3600, teamId: team.id });
    const sessionId = sessionRes.body.session.id;

    await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${submitter.token}`)
      .send(validTrackBody());

    const listAsSubmitter = await request(getServer())
      .get(`/api/sessions?teamId=${team.id}`)
      .set("Authorization", `Bearer ${submitter.token}`);
    expect(listAsSubmitter.status).toBe(200);
    const s1 = listAsSubmitter.body.sessions.find((s: { id: number }) => s.id === sessionId);
    expect(s1.mySubmitted).toBe(true);

    const listAsNonSubmitter = await request(getServer())
      .get(`/api/sessions?teamId=${team.id}`)
      .set("Authorization", `Bearer ${nonSubmitter.token}`);
    const s2 = listAsNonSubmitter.body.sessions.find((s: { id: number }) => s.id === sessionId);
    expect(s2.mySubmitted).toBe(false);
  });

  test("生のtracks配列は一覧レスポンスに含まれない（mySubmittedへ畳んで返す。ARCH.md §4）", async () => {
    const user = await registerUser("t29d");
    const team = await createTeam("t29d");
    await addMember(user.userId, team.id);
    await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ title: "練習", type: "practice", startedAt: "2026-08-01T05:00:00.000Z", durationSec: 3600, teamId: team.id });

    const res = await request(getServer())
      .get(`/api/sessions?teamId=${team.id}`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(res.body.sessions[0].tracks).toBeUndefined();
  });
});
