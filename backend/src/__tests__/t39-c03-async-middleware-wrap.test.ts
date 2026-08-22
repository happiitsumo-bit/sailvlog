// C-03回帰（Issue #39）: requireTeamMemberByBody()・requireSessionTeamMember()は
// async ミドルウェアだが、以前はマウント側で wrap() されずに渡されていた。
// Express 4はasyncミドルウェアのreject（=prismaが投げた例外）をキャッチしないため、
// ミドルウェア内でエラーが起きるとハンドラチェーンが止まり、そのリクエストだけ応答を
// 返さずハングしていた（t96-global-error-handler.test.tsと同じ手法でDB例外を注入して検証する）。
// wrap()で包まれていれば、reject時もグローバルエラーハンドラに届いて500が返る。
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
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T39テストチーム" },
  });
}

describe("C-03: requireTeamMemberByBody() は wrap() されている（POST /api/sessions）", () => {
  test("ミドルウェア内のDB例外は500で返る（ハングしない）", async () => {
    const { userId, token } = await registerUser("c03-body");
    const team = await createTeam("c03-body");
    await prisma.teamMember.create({ data: { userId, teamId: team.id, role: "member" } });

    const consoleErrSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const spy = jest
      .spyOn(prisma.teamMember, "findUnique")
      .mockRejectedValueOnce(new Error("simulated DB failure inside requireTeamMemberByBody"));

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "第1回練習",
        type: "practice",
        startedAt: "2026-07-24T05:00:00.000Z",
        durationSec: 7200,
        teamId: team.id,
      });

    expect(res.status).toBe(500);

    spy.mockRestore();
    consoleErrSpy.mockRestore();

    // プロセス・サーバが生きていることの証明（後続リクエストが正常応答する）
    const following = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "第1回練習",
        type: "practice",
        startedAt: "2026-07-24T05:00:00.000Z",
        durationSec: 7200,
        teamId: team.id,
      });
    expect(following.status).toBe(201);
  });
});

describe("C-03（横断確認）: requireSessionTeamMember() も wrap() されている（GET /api/sessions/:id）", () => {
  test("ミドルウェア内のDB例外は500で返る（ハングしない）", async () => {
    const { userId, token } = await registerUser("c03-session");
    const team = await createTeam("c03-session");
    await prisma.teamMember.create({ data: { userId, teamId: team.id, role: "member" } });

    const created = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "第1回練習",
        type: "practice",
        startedAt: "2026-07-24T05:00:00.000Z",
        durationSec: 7200,
        teamId: team.id,
      });
    expect(created.status).toBe(201);
    const sessionId = created.body.session.id;

    const consoleErrSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const spy = jest
      .spyOn(prisma.session, "findUnique")
      .mockRejectedValueOnce(new Error("simulated DB failure inside requireSessionTeamMember"));

    const res = await request(getServer())
      .get(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);

    spy.mockRestore();
    consoleErrSpy.mockRestore();

    const following = await request(getServer())
      .get(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(following.status).toBe(200);
  });
});
