// T-34 (Issue #34): 新規ユーザーがUIから辿る経路（登録→チーム作成→招待参加→セッション作成）を
// backendのAPI契約として通しで検証する。フロント側の /teams UIはこの並びでAPIを呼ぶだけであり、
// この鎖が壊れていないことが「First Runが成立する」ことの直接の裏付けになる。
// e2eブラウザ自動化基盤（Playwright等）はこのリポジトリに未導入のため、API層での通し検証とする。
import request from "supertest";
import { setupTestServer } from "./helpers/testServer";
import {
  _resetJoinRateLimiterForTests,
  _resetCreateTeamRateLimiterForTests,
} from "../lib/rateLimiter";

const PASSWORD = "password123";
const getServer = setupTestServer();

beforeEach(() => {
  _resetJoinRateLimiterForTests();
  _resetCreateTeamRateLimiterForTests();
});

async function registerUser(tag: string): Promise<{ userId: number; token: string }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await request(getServer())
    .post("/api/auth/register")
    .send({ username: `u${unique}`.slice(0, 30), email: `${unique}@example.com`, password: PASSWORD });
  expect(res.status).toBe(201);
  return { userId: res.body.user.id, token: res.body.token };
}

describe("T-34: First Run（登録→チーム作成→招待参加→セッション作成）", () => {
  test("未所属ユーザーがチームを作成し、招待コードで別ユーザーが参加し、両者がセッションを作成・閲覧できる", async () => {
    const creator = await registerUser("firstrun-creator");

    // 登録直後は所属チーム0件（Issue本文の前提）
    const initialTeams = await request(getServer())
      .get("/api/teams")
      .set("Authorization", `Bearer ${creator.token}`);
    expect(initialTeams.status).toBe(200);
    expect(initialTeams.body.teams).toEqual([]);

    // チーム作成（/teams UIの「チームを作る」経路）
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createRes = await request(getServer())
      .post("/api/teams")
      .set("Authorization", `Bearer ${creator.token}`)
      .send({ name: `First Runテストチーム-${unique}`, slug: `firstrun-${unique}` });
    expect(createRes.status).toBe(201);
    const { team, inviteCode } = createRes.body;
    expect(inviteCode).toMatch(/^[A-Za-z0-9_-]+$/);

    // 招待コードで別ユーザーが参加（/teams UIの「招待コードで参加する」経路）
    const joiner = await registerUser("firstrun-joiner");
    const joinRes = await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${joiner.token}`)
      .send({ inviteCode });
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.team.slug).toBe(team.slug);

    // 両者ともGET /api/teamsにこのチームが現れる
    for (const token of [creator.token, joiner.token]) {
      const list = await request(getServer()).get("/api/teams").set("Authorization", `Bearer ${token}`);
      expect(list.status).toBe(200);
      expect(list.body.teams.some((t: { id: number }) => t.id === team.id)).toBe(true);
    }

    // セッション作成まで到達できる（GPX取込の前段。取込自体はフロントのGPXパーサ側のためbackend契約はここまで）
    const sessionRes = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${creator.token}`)
      .send({
        title: "First Run 検証セッション",
        type: "practice",
        startedAt: new Date().toISOString(),
        durationSec: 600,
        teamId: team.id,
      });
    expect(sessionRes.status).toBe(201);

    // 参加者（member）もセッション一覧を閲覧できる
    const sessionsForJoiner = await request(getServer())
      .get(`/api/sessions?teamId=${team.id}`)
      .set("Authorization", `Bearer ${joiner.token}`);
    expect(sessionsForJoiner.status).toBe(200);
    expect(sessionsForJoiner.body.sessions.some((s: { id: number }) => s.id === sessionRes.body.session.id)).toBe(
      true
    );
  });

  test("不正な招待コードでは参加できない（存在オラクルにならない404）", async () => {
    const joiner = await registerUser("firstrun-badcode");
    const res = await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${joiner.token}`)
      .send({ inviteCode: "not-a-real-code" });
    expect(res.status).toBe(404);
  });
});
