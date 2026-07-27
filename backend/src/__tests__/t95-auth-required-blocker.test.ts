// T-95: Quality Gate Blocker修正の検証。
// 元々の指摘: 未認証で GET /api/teams・/api/teams/:slug・/api/sailors・/api/sailors/:username・
// /api/users/:username が200を返し部員名簿(username/specialty/experienceYears/avatarUrl/boatType)まで
// 取得できていた問題（R-01修正）。
//
// B-02修正（2026-07-27, REVIEW-backend-2.md）: R-01の`authMiddleware`追加は、POST /api/auth/register が
// 招待制でも承認制でもないため「1リクエスト増えただけ」で迂回できていた（部外者が登録すればログイン済み
// になれる）。機密境界を「認証済みか」から「そのチームのメンバーという関係にあるか」に直し、
// GET /api/teams は自分の所属チームのみ・GET /api/teams/:slug は非メンバーに404、
// GET /api/sailors・/api/sailors/:username・/api/users/:username はチーム横断で「関係」を
// 定義できない機能のため410凍結（v3 frontend利用ゼロ・ADR-003と同方式）に変更した。
// このテストは新仕様を検証する。
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
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T95テストチーム" },
  });
}

async function addMember(userId: number, teamId: number) {
  return prisma.teamMember.create({ data: { userId, teamId, role: "member" } });
}

describe("T-95/B-02修正: 名簿系APIの機密境界", () => {
  test("GET /api/teams — 未認証401・認証済みは自分の所属チームのみ（他チームは含まれない）", async () => {
    const { userId, token } = await registerUser("teams-list");
    const myTeam = await createTeam("mine");
    await addMember(userId, myTeam.id);
    await createTeam("other"); // 自分は非所属

    const unauth = await request(getServer()).get("/api/teams");
    expect(unauth.status).toBe(401);

    const auth = await request(getServer()).get("/api/teams").set("Authorization", `Bearer ${token}`);
    expect(auth.status).toBe(200);
    const slugs = auth.body.teams.map((t: { slug: string }) => t.slug);
    expect(slugs).toContain(myTeam.slug);
    expect(auth.body.teams.length).toBe(1);
  });

  test("GET /api/teams/:slug — 未認証401・自チームメンバーは200（部員名簿を含む）・非メンバーは404", async () => {
    const { userId, token } = await registerUser("teams-detail");
    const team = await createTeam("detail");
    await addMember(userId, team.id);
    const outsider = await registerUser("teams-detail-outsider");

    const unauth = await request(getServer()).get(`/api/teams/${team.slug}`);
    expect(unauth.status).toBe(401);

    const auth = await request(getServer()).get(`/api/teams/${team.slug}`).set("Authorization", `Bearer ${token}`);
    expect(auth.status).toBe(200);
    expect(auth.body.members[0].user.username).toBeDefined();

    const outsiderRes = await request(getServer())
      .get(`/api/teams/${team.slug}`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(outsiderRes.status).toBe(404);
  });

  test("GET /api/teams/:slug/articles・/questions — 凍結済み（410。認証有無を問わない）", async () => {
    const { userId, token } = await registerUser("teams-articles");
    const team = await createTeam("articles");
    await addMember(userId, team.id);

    const unauthArticles = await request(getServer()).get(`/api/teams/${team.slug}/articles`);
    expect(unauthArticles.status).toBe(410);

    const authArticles = await request(getServer())
      .get(`/api/teams/${team.slug}/articles`)
      .set("Authorization", `Bearer ${token}`);
    expect(authArticles.status).toBe(410);

    const questions = await request(getServer()).get(`/api/teams/${team.slug}/questions`);
    expect(questions.status).toBe(410);
  });

  test("GET /api/sailors — 凍結済み（410。認証有無を問わない）", async () => {
    const { token } = await registerUser("sailors-list");

    const unauth = await request(getServer()).get("/api/sailors");
    expect(unauth.status).toBe(410);

    const auth = await request(getServer()).get("/api/sailors").set("Authorization", `Bearer ${token}`);
    expect(auth.status).toBe(410);
  });

  test("GET /api/sailors/:username — 凍結済み（410。認証有無を問わない）", async () => {
    const target = await registerUser("sailors-detail-target");
    const { token } = await registerUser("sailors-detail-caller");
    const targetUser = await prisma.user.findUnique({ where: { id: target.userId } });

    const unauth = await request(getServer()).get(`/api/sailors/${targetUser!.username}`);
    expect(unauth.status).toBe(410);

    const auth = await request(getServer())
      .get(`/api/sailors/${targetUser!.username}`)
      .set("Authorization", `Bearer ${token}`);
    expect(auth.status).toBe(410);
  });

  test("GET /api/users/:username — 凍結済み（410。認証有無を問わない）。/me は本人限定で生存", async () => {
    const target = await registerUser("users-detail-target");
    const { token } = await registerUser("users-detail-caller");
    const targetUser = await prisma.user.findUnique({ where: { id: target.userId } });

    const unauth = await request(getServer()).get(`/api/users/${targetUser!.username}`);
    expect(unauth.status).toBe(410);

    const auth = await request(getServer())
      .get(`/api/users/${targetUser!.username}`)
      .set("Authorization", `Bearer ${token}`);
    expect(auth.status).toBe(410);

    const me = await request(getServer()).get("/api/users/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
  });

  // M3-01回帰テスト（2026-07-28, REVIEW-backend-3.md）: router.all("/:username") が
  // router.put("/me") より先に登録されていたため "me" がusernameとしてマッチし、
  // 修正コミット自身のコメント「PUT /api/users/me は凍結対象外（残す）」に反して410を返していた。
  // GET /me のみを検証していた上のテストは、このメソッド違いの取りこぼしを素通ししていた。
  test("PUT /api/users/me — 凍結の巻き込みを受けず200で自分のプロフィールを更新できる", async () => {
    const { token } = await registerUser("users-put-me");

    const res = await request(getServer())
      .put("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "PUT /me が410に飲まれていないことの確認" });

    expect(res.status).toBe(200);
    expect(res.body.bio).toBe("PUT /me が410に飲まれていないことの確認");
  });
});

// M3-05回帰テスト（2026-07-28, REVIEW-backend-3.md）: GET :id(R-02)・一覧(M-02)では
// publicViewCountが除外済みだったが、POST/PATCH /api/sessionsだけprisma呼び出しの
// 戻り値をそのまま返しており同じ指摘が3回目出ていた。共通シリアライザ(lib/serializeSession.ts)
// への一本化で、この2経路が塞がれたことを固定する。
describe("M3-05: POST/PATCH /api/sessions のレスポンスにpublicViewCountが含まれない", () => {
  test("POST /api/sessions のレスポンスにpublicViewCountが含まれない", async () => {
    const uploader = await registerUser("m305-post");
    const team = await createTeam("m305-post");
    await addMember(uploader.userId, team.id);

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ title: "M3-05確認用", type: "practice", startedAt: "2026-07-24T05:00:00.000Z", durationSec: 600, teamId: team.id });

    expect(res.status).toBe(201);
    expect(res.body.session).not.toHaveProperty("publicViewCount");
    expect(JSON.stringify(res.body)).not.toContain("publicViewCount");
  });

  test("PATCH /api/sessions/:id のレスポンスにpublicViewCountが含まれない（公開ビュー数がある状態でも）", async () => {
    const uploader = await registerUser("m305-patch");
    const team = await createTeam("m305-patch");
    await addMember(uploader.userId, team.id);
    const createRes = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ title: "PATCH前", type: "practice", startedAt: "2026-07-24T05:00:00.000Z", durationSec: 600, teamId: team.id });
    const sessionId = createRes.body.session.id as number;
    await prisma.session.update({ where: { id: sessionId }, data: { publicViewCount: 7 } });

    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ title: "M3-05 PATCH確認用" });

    expect(res.status).toBe(200);
    expect(res.body.session).not.toHaveProperty("publicViewCount");
    expect(JSON.stringify(res.body)).not.toContain("publicViewCount");
  });
});
