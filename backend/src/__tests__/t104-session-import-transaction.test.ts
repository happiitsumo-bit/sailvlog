// T-104 (Issue #40 / routine/40-import-transaction):
// 複数艇アップロードの途中失敗で、セッションと先行トラックだけがDBに残る事故の回帰テスト。
// 修正案(b): POST /api/sessions に任意の tracks 配列を渡すと、セッション作成と
// トラック投入を1トランザクションにまとめる。2本目のトラックが不正な場合、
// 1本目も含めて何も作られない（ロールバック）ことを検証する。
import request from "supertest";
import { setupTestServer } from "./helpers/testServer";
import prisma from "../database";
import { validTrackPayload, payloadWithLatOutOfRange } from "./fixtures/trackPayloads";

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
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T104テストチーム" },
  });
}

async function addMember(userId: number, teamId: number) {
  return prisma.teamMember.create({ data: { userId, teamId, role: "member" } });
}

function validSessionBody(teamId: number, overrides: Record<string, unknown> = {}) {
  return {
    title: "複数艇取込テスト",
    type: "practice",
    startedAt: "2026-07-24T05:00:00.000Z",
    durationSec: 3600,
    teamId,
    ...overrides,
  };
}

describe("POST /api/sessions with tracks (T-104)", () => {
  test("tracksを2件同時に渡すと、セッションと両方のトラックが1リクエストで作られる", async () => {
    const user = await registerUser("import-ok");
    const team = await createTeam("import-ok");
    await addMember(user.userId, team.id);

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(
        validSessionBody(team.id, {
          tracks: [validTrackPayload({ boatLabel: "1号艇" }), validTrackPayload({ boatLabel: "2号艇" })],
        })
      );

    expect(res.status).toBe(201);
    expect(res.body.session.id).toBeGreaterThan(0);
    expect(res.body.tracks).toHaveLength(2);
    expect(res.body.tracks.map((t: { boatLabel: string }) => t.boatLabel).sort()).toEqual(["1号艇", "2号艇"]);
    // gridJson/rawGpxはメタ応答から除外される（ARCH.md §4と同じ整形）
    expect(res.body.tracks[0].gridJson).toBeUndefined();
    expect(res.body.tracks[0].rawGpx).toBeUndefined();

    const storedTracks = await prisma.track.findMany({ where: { sessionId: res.body.session.id } });
    expect(storedTracks).toHaveLength(2);
  });

  test("2本目のtracksが不正だと400になり、セッションも1本目のトラックもDBに残らない（ロールバック）", async () => {
    const user = await registerUser("import-fail");
    const team = await createTeam("import-fail");
    await addMember(user.userId, team.id);

    const sessionsBefore = await prisma.session.count({ where: { teamId: team.id } });

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(
        validSessionBody(team.id, {
          tracks: [validTrackPayload({ boatLabel: "1号艇" }), payloadWithLatOutOfRange()],
        })
      );

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^tracks\[1\]:/);

    const sessionsAfter = await prisma.session.count({ where: { teamId: team.id } });
    expect(sessionsAfter).toBe(sessionsBefore); // ゴミセッションが残っていない

    const orphanTracks = await prisma.track.findMany({
      where: { session: { teamId: team.id } },
    });
    expect(orphanTracks).toHaveLength(0); // 1本目のトラックも残っていない
  });

  test("tracksを空配列で渡すと400（セッションも作られない）", async () => {
    const user = await registerUser("import-empty");
    const team = await createTeam("import-empty");
    await addMember(user.userId, team.id);

    const sessionsBefore = await prisma.session.count({ where: { teamId: team.id } });

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(validSessionBody(team.id, { tracks: [] }));

    expect(res.status).toBe(400);
    const sessionsAfter = await prisma.session.count({ where: { teamId: team.id } });
    expect(sessionsAfter).toBe(sessionsBefore);
  });

  test("tracksを省略すると従来どおりセッションのみ作られる（後方互換）", async () => {
    const user = await registerUser("import-omit");
    const team = await createTeam("import-omit");
    await addMember(user.userId, team.id);

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(validSessionBody(team.id));

    expect(res.status).toBe(201);
    expect(res.body.tracks).toEqual([]);

    const storedTracks = await prisma.track.findMany({ where: { sessionId: res.body.session.id } });
    expect(storedTracks).toHaveLength(0);
  });
});
