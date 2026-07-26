// T-95: Quality Gate Blocker修正の検証。
// 未認証で GET /api/teams・/api/teams/:slug・/api/sailors・/api/sailors/:username・/api/users/:username が
// 200を返し部員名簿(username/specialty/experienceYears/avatarUrl/boatType)まで取得できていた問題の回帰テスト。
// 「未認証で401、認証済みで200」を各エンドポイントで検証する。
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
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T95テストチーム" },
  });
}

async function addMember(userId: number, teamId: number) {
  return prisma.teamMember.create({ data: { userId, teamId, role: "member" } });
}

describe("T-95 Blocker修正: 未認証で名簿系APIが叩けてしまう問題", () => {
  test("GET /api/teams — 未認証401・認証済み200", async () => {
    const { token } = await registerUser("teams-list");

    const unauth = await request(app).get("/api/teams");
    expect(unauth.status).toBe(401);

    const auth = await request(app).get("/api/teams").set("Authorization", `Bearer ${token}`);
    expect(auth.status).toBe(200);
  });

  test("GET /api/teams/:slug — 未認証401・認証済み200（部員名簿を含む）", async () => {
    const { userId, token } = await registerUser("teams-detail");
    const team = await createTeam("detail");
    await addMember(userId, team.id);

    const unauth = await request(app).get(`/api/teams/${team.slug}`);
    expect(unauth.status).toBe(401);

    const auth = await request(app).get(`/api/teams/${team.slug}`).set("Authorization", `Bearer ${token}`);
    expect(auth.status).toBe(200);
    expect(auth.body.members[0].user.username).toBeDefined();
  });

  test("GET /api/sailors — 未認証401・認証済み200", async () => {
    const { token } = await registerUser("sailors-list");

    const unauth = await request(app).get("/api/sailors");
    expect(unauth.status).toBe(401);

    const auth = await request(app).get("/api/sailors").set("Authorization", `Bearer ${token}`);
    expect(auth.status).toBe(200);
  });

  test("GET /api/sailors/:username — 未認証401・認証済み200", async () => {
    const target = await registerUser("sailors-detail-target");
    const { token } = await registerUser("sailors-detail-caller");
    const targetUser = await prisma.user.findUnique({ where: { id: target.userId } });

    const unauth = await request(app).get(`/api/sailors/${targetUser!.username}`);
    expect(unauth.status).toBe(401);

    const auth = await request(app)
      .get(`/api/sailors/${targetUser!.username}`)
      .set("Authorization", `Bearer ${token}`);
    expect(auth.status).toBe(200);
  });

  test("GET /api/users/:username — 未認証401・認証済み200", async () => {
    const target = await registerUser("users-detail-target");
    const { token } = await registerUser("users-detail-caller");
    const targetUser = await prisma.user.findUnique({ where: { id: target.userId } });

    const unauth = await request(app).get(`/api/users/${targetUser!.username}`);
    expect(unauth.status).toBe(401);

    const auth = await request(app)
      .get(`/api/users/${targetUser!.username}`)
      .set("Authorization", `Bearer ${token}`);
    expect(auth.status).toBe(200);
  });
});
