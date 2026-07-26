// T-96: Quality Gate Major修正の検証。
// DB例外等でasyncハンドラが例外を投げても、プロセスが落ちずに500応答が返ることを確認する
// （express-async-errors + index.ts のグローバルエラーハンドラ）。
// GET /api/sessions?teamId= はtry/catchを持たない素のasyncハンドラで、
// 「個別のtry/catchを持たないルートでも安全網が効く」ことの検証に適している。
import request from "supertest";
import app from "../index";
import prisma from "../database";

async function registerUser(tag: string): Promise<{ userId: number; token: string }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await request(app)
    .post("/api/auth/register")
    .send({ username: `u${unique}`.slice(0, 30), email: `${unique}@example.com`, password: "password123" });
  return { userId: res.body.user.id, token: res.body.token };
}

async function createTeam(tag: string) {
  return prisma.team.create({
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T96テストチーム" },
  });
}

describe("T-96 Major修正: グローバルエラーハンドラでプロセスが落ちない", () => {
  test("DB例外を意図的に発生させても500が返り、直後の別リクエストも正常に処理される(プロセス生存の証明)", async () => {
    const { userId, token } = await registerUser("errhandler");
    const team = await createTeam("errhandler");
    await prisma.teamMember.create({ data: { userId, teamId: team.id, role: "member" } });

    const spy = jest
      .spyOn(prisma.session, "findMany")
      .mockRejectedValueOnce(new Error("simulated DB connection failure"));

    const consoleErrSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const failing = await request(app).get(`/api/sessions?teamId=${team.id}`).set(
      "Authorization",
      `Bearer ${token}`
    );
    expect(failing.status).toBe(500);

    spy.mockRestore();
    consoleErrSpy.mockRestore();

    // プロセスが生きていること・後続リクエストが正常応答することを確認する
    const following = await request(app).get(`/api/sessions?teamId=${team.id}`).set(
      "Authorization",
      `Bearer ${token}`
    );
    expect(following.status).toBe(200);
    expect(following.body.sessions).toEqual([]);
  });
});
