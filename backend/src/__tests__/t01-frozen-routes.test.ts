// T-01: 凍結ルートの410化スモークテスト
// 検証対象: 凍結エンドポイントが410、auth/login・GET /teams は生存（200のまま）
import request from "supertest";
import app from "../index";
import prisma from "../database";

describe("T-01 凍結ルート", () => {
  const frozenGetPaths = [
    "/api/articles",
    "/api/tags",
    "/api/bookmarks",
    "/api/questions",
    "/api/posts",
    "/api/courses",
  ];

  test.each(frozenGetPaths)("GET %s は410を返す", async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(410);
  });

  test("フォロー系（凍結）は410を返す", async () => {
    const res = await request(app).post("/api/users/someone/follow");
    expect(res.status).toBe(410);
  });
});

describe("T-01 存続ルート", () => {
  const email = `t01-smoke-${Date.now()}@example.com`;
  const password = "smoke-test-password";

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  test("register→login が200/201のまま", async () => {
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ username: `t01smoke${Date.now()}`, email, password });
    expect(registerRes.status).toBe(201);

    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
  });

  // Quality Gate Blocker修正(T-95)により、GET /api/teams は未認証401・認証済み200へ仕様変更した
  // （未認証で全チームslug＋部員名簿まで取得できていたため）。「存続ルート」であることの検証は
  // 維持しつつ、期待値をBlocker修正後の仕様に合わせる。
  test("GET /api/teams は認証済みなら200のまま（未認証は401）", async () => {
    const unauth = await request(app).get("/api/teams");
    expect(unauth.status).toBe(401);

    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    const authed = await request(app)
      .get("/api/teams")
      .set("Authorization", `Bearer ${loginRes.body.token}`);
    expect(authed.status).toBe(200);
  });
});
