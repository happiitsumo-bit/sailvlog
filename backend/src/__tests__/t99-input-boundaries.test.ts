// T-90 (qa-engineer): REVIEW.md「テスト・CIの評価」向けの入力境界テスト。
// 数値の負数・0・NaN(=JSON化するとnullに潰れるため実質nullケースとして検証)・巨大値・型違い、
// 文字列長境界、余計なキー混入を、既存のtrackPayloads.tsのカバレッジで漏れている箇所に絞って追加する。
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
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T99テストチーム" },
  });
}

async function addMember(userId: number, teamId: number) {
  return prisma.teamMember.create({ data: { userId, teamId, role: "member" } });
}

function validSessionBody(teamId: number, overrides: Record<string, unknown> = {}) {
  return {
    title: "境界値確認",
    type: "practice",
    startedAt: "2026-07-24T05:00:00.000Z",
    durationSec: 3600,
    teamId,
    ...overrides,
  };
}

describe("POST /api/sessions: durationSec の数値境界", () => {
  test.each([
    ["0", 0],
    ["負数", -1],
    ["null(JSON上のNaN相当)", null],
    ["文字列", "3600"],
    ["小数", 3600.5],
    ["配列", [3600]],
    ["上限超過(4時間+1秒)", 14401],
  ])("durationSec=%s は400", async (_label, value) => {
    const user = await registerUser("dur");
    const team = await createTeam("dur");
    await addMember(user.userId, team.id);

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(validSessionBody(team.id, { durationSec: value }));
    expect(res.status).toBe(400);
  });

  test("durationSec=上限ちょうど(14400)は201(境界OK)", async () => {
    const user = await registerUser("dur-ok");
    const team = await createTeam("dur-ok");
    await addMember(user.userId, team.id);

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(validSessionBody(team.id, { durationSec: 14400 }));
    expect(res.status).toBe(201);
  });

  test("durationSec=1(下限ちょうど)は201(境界OK)", async () => {
    const user = await registerUser("dur-ok2");
    const team = await createTeam("dur-ok2");
    await addMember(user.userId, team.id);

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(validSessionBody(team.id, { durationSec: 1 }));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/sessions: teamId の型違い・不正値", () => {
  test("teamIdが存在しないチームIDだと403(TeamMemberではない扱い)", async () => {
    const user = await registerUser("noteam");
    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(validSessionBody(999999));
    expect(res.status).toBe(403);
  });

  test("teamIdが文字列'abc'(数値化不能)は400", async () => {
    const user = await registerUser("badteam");
    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(validSessionBody("abc" as unknown as number));
    expect(res.status).toBe(400);
  });

  test("teamIdがnullは400", async () => {
    const user = await registerUser("nullteam");
    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(validSessionBody(null as unknown as number));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/sessions/:id/annotations: tSec の境界", () => {
  async function createSessionAsMember(durationSec = 100) {
    const uploader = await registerUser("annobound");
    const team = await createTeam("annobound");
    await addMember(uploader.userId, team.id);
    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(validSessionBody(team.id, { durationSec }));
    return { sessionId: res.body.session.id as number, uploader, durationSec };
  }

  test("tSec=0(下限ちょうど)は201", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 0, body: "開始直後" });
    expect(res.status).toBe(201);
  });

  test("tSec=durationSec(上限ちょうど)は201", async () => {
    const { sessionId, uploader, durationSec } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: durationSec, body: "終了直前" });
    expect(res.status).toBe(201);
  });

  test("tSec=-1(下限未満)は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: -1, body: "範囲外" });
    expect(res.status).toBe(400);
  });

  test("tSecが小数は400(整数のみ許可)", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 10.5, body: "小数" });
    expect(res.status).toBe(400);
  });

  test("tSecが文字列は400(型違い)", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: "10", body: "文字列" });
    expect(res.status).toBe(400);
  });

  test("bodyがnullは400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 5, body: null });
    expect(res.status).toBe(400);
  });

  test("bodyが空白のみは400(trim後0文字)", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 5, body: "   " });
    expect(res.status).toBe(400);
  });

  test("bodyちょうど2000字は201(境界OK、2001字は既存テストで400)", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 5, body: "あ".repeat(2000) });
    expect(res.status).toBe(201);
  });
});

describe("GET /api/sessions/:id: 不正なID形式", () => {
  test("idが数値化不能な文字列は400", async () => {
    const user = await registerUser("badid");
    const res = await request(getServer())
      .get("/api/sessions/not-a-number")
      .set("Authorization", `Bearer ${user.token}`);
    expect(res.status).toBe(400);
  });
});
