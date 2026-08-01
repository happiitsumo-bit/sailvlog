// T-103 (implementer, 2026-07-30): ADR-013 / B3-02「チーム加入経路がbackendに存在しない」の実装検証。
//
// 対象: POST /api/teams（作成）・POST /api/teams/join（加入）・GET /:slug/invite（admin専用）・
// POST /:slug/invite/rotate（admin専用）・PATCH /:slug/members/:userId（admin専用）・
// DELETE /:slug/members/:userId（admin or 本人の脱退）。
//
// このファイルでとくに固定したい回帰:
//   ①不正な招待コードは404（403やteam存在を教える別ステータスにしない。ADR-013決定1）
//   ②GET /api/teams・GET /api/teams/:slug のレスポンスに inviteCode キーが含まれない
//     （R-02/M-02と同型の欠陥への回帰ガード。ADR-013決定4）
//   ③rotate後は旧コードで加入できない
//   ④最後のadminは削除できない（409）。自分自身の脱退は成功する
import request from "supertest";
import { setupTestServer } from "./helpers/testServer";
import { _resetJoinRateLimiterForTests } from "../lib/rateLimiter";

const PASSWORD = "password123";
const getServer = setupTestServer();

beforeEach(() => {
  _resetJoinRateLimiterForTests();
});

async function registerUser(tag: string): Promise<{ userId: number; token: string }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await request(getServer())
    .post("/api/auth/register")
    .send({ username: `u${unique}`.slice(0, 30), email: `${unique}@example.com`, password: PASSWORD });
  expect(res.status).toBe(201);
  return { userId: res.body.user.id, token: res.body.token };
}

async function createTeam(token: string, tag: string): Promise<{ slug: string; inviteCode: string }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await request(getServer())
    .post("/api/teams")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `T103テストチーム-${tag}`, slug: `t103-${unique}` });
  expect(res.status).toBe(201);
  return { slug: res.body.team.slug, inviteCode: res.body.inviteCode };
}

describe("T-103 ADR-013: POST /api/teams", () => {
  test("チーム作成 → 作成者がadminのTeamMemberになっている", async () => {
    const creator = await registerUser("create-admin");
    const { slug } = await createTeam(creator.token, "create-admin");

    const detail = await request(getServer())
      .get(`/api/teams/${slug}`)
      .set("Authorization", `Bearer ${creator.token}`);
    expect(detail.status).toBe(200);
    const member = detail.body.members.find((m: { userId: number }) => m.userId === creator.userId);
    expect(member).toBeDefined();
    expect(member.role).toBe("admin");
  });
});

describe("T-103 ADR-013: POST /api/teams/join", () => {
  test("正しいコードで加入できる／既にメンバーなら冪等に200", async () => {
    const admin = await registerUser("join-admin");
    const joiner = await registerUser("join-member");
    const { slug, inviteCode } = await createTeam(admin.token, "join");

    const first = await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${joiner.token}`)
      .send({ inviteCode });
    expect(first.status).toBe(200);
    expect(first.body.team.slug).toBe(slug);

    // 既にメンバー → 冪等に200（二重メンバー登録エラーにならない）
    const second = await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${joiner.token}`)
      .send({ inviteCode });
    expect(second.status).toBe(200);
    expect(second.body.team.slug).toBe(slug);
  });

  test("不正なコードは404（403やteamが無いこと以外を漏らさない）", async () => {
    const joiner = await registerUser("join-bad-code");

    const res = await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${joiner.token}`)
      .send({ inviteCode: "this-code-does-not-exist-at-all" });
    expect(res.status).toBe(404);
  });

  test("未認証は401（authMiddlewareが先に効く）", async () => {
    const res = await request(getServer()).post("/api/teams/join").send({ inviteCode: "whatever" });
    expect(res.status).toBe(401);
  });

  test("rotate後は旧コードで加入できない", async () => {
    const admin = await registerUser("rotate-admin");
    const joiner = await registerUser("rotate-joiner");
    const { slug, inviteCode: oldCode } = await createTeam(admin.token, "rotate");

    const rotateRes = await request(getServer())
      .post(`/api/teams/${slug}/invite/rotate`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(rotateRes.status).toBe(200);
    expect(rotateRes.body.inviteCode).toBeDefined();
    expect(rotateRes.body.inviteCode).not.toBe(oldCode);

    const joinWithOld = await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${joiner.token}`)
      .send({ inviteCode: oldCode });
    expect(joinWithOld.status).toBe(404);

    const joinWithNew = await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${joiner.token}`)
      .send({ inviteCode: rotateRes.body.inviteCode });
    expect(joinWithNew.status).toBe(200);
  });
});

describe("T-103 ADR-013: GET /:slug/invite", () => {
  test("admin以外(member)は403、非メンバーは404", async () => {
    const admin = await registerUser("invite-admin");
    const member = await registerUser("invite-member");
    const outsider = await registerUser("invite-outsider");
    const { slug, inviteCode } = await createTeam(admin.token, "invite");

    await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode });

    const asAdmin = await request(getServer())
      .get(`/api/teams/${slug}/invite`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.inviteCode).toBe(inviteCode);

    const asMember = await request(getServer())
      .get(`/api/teams/${slug}/invite`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(asMember.status).toBe(403);

    const asOutsider = await request(getServer())
      .get(`/api/teams/${slug}/invite`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(asOutsider.status).toBe(404);
  });
});

describe("T-103 ADR-013決定4: GET /api/teams・GET /api/teams/:slug に inviteCode が含まれない", () => {
  test("一般メンバーとして一覧・詳細を取得してもinviteCodeキーが含まれない", async () => {
    const admin = await registerUser("no-leak-admin");
    const member = await registerUser("no-leak-member");
    const { slug, inviteCode } = await createTeam(admin.token, "no-leak");

    await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode });

    const list = await request(getServer()).get("/api/teams").set("Authorization", `Bearer ${member.token}`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(inviteCode);
    for (const team of list.body.teams) {
      expect(team).not.toHaveProperty("inviteCode");
    }

    const detail = await request(getServer())
      .get(`/api/teams/${slug}`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body).not.toHaveProperty("inviteCode");
    expect(JSON.stringify(detail.body)).not.toContain(inviteCode);
  });

  test("adminとして一覧・詳細を取得してもinviteCodeキーが含まれない（漏洩経路はGET /:slug/inviteのみ）", async () => {
    const admin = await registerUser("no-leak-admin-self");
    const { slug, inviteCode } = await createTeam(admin.token, "no-leak-admin-self");

    const list = await request(getServer()).get("/api/teams").set("Authorization", `Bearer ${admin.token}`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(inviteCode);

    const detail = await request(getServer())
      .get(`/api/teams/${slug}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body).not.toHaveProperty("inviteCode");
  });
});

describe("T-103 ADR-013決定6: DELETE /:slug/members/:userId", () => {
  test("最後のadminを削除しようとすると409", async () => {
    const admin = await registerUser("last-admin");
    const member = await registerUser("last-admin-member");
    const { slug, inviteCode } = await createTeam(admin.token, "last-admin");

    await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode });

    const res = await request(getServer())
      .delete(`/api/teams/${slug}/members/${admin.userId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(409);
  });

  test("自分自身のDELETEは脱退として成功する（メンバーが自分を削除、admin権限不要）", async () => {
    const admin = await registerUser("self-leave-admin");
    const member = await registerUser("self-leave-member");
    const { slug, inviteCode } = await createTeam(admin.token, "self-leave");

    await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode });

    const res = await request(getServer())
      .delete(`/api/teams/${slug}/members/${member.userId}`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(res.status).toBe(204);

    // 脱退後はチーム詳細が404になる（非メンバー化した証拠）
    const after = await request(getServer())
      .get(`/api/teams/${slug}`)
      .set("Authorization", `Bearer ${member.token}`);
    expect(after.status).toBe(404);
  });

  test("非adminが他人を削除しようとすると403", async () => {
    const admin = await registerUser("forbidden-admin");
    const memberA = await registerUser("forbidden-member-a");
    const memberB = await registerUser("forbidden-member-b");
    const { slug, inviteCode } = await createTeam(admin.token, "forbidden");

    await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${memberA.token}`)
      .send({ inviteCode });
    await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${memberB.token}`)
      .send({ inviteCode });

    const res = await request(getServer())
      .delete(`/api/teams/${slug}/members/${memberB.userId}`)
      .set("Authorization", `Bearer ${memberA.token}`);
    expect(res.status).toBe(403);
  });
});

describe("T-103 ADR-013: PATCH /:slug/members/:userId", () => {
  test("adminはメンバーのroleを変更できる。admin以外は403", async () => {
    const admin = await registerUser("patch-admin");
    const member = await registerUser("patch-member");
    const { slug, inviteCode } = await createTeam(admin.token, "patch");

    await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode });

    const asMember = await request(getServer())
      .patch(`/api/teams/${slug}/members/${member.userId}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ role: "admin" });
    expect(asMember.status).toBe(403);

    const asAdmin = await request(getServer())
      .patch(`/api/teams/${slug}/members/${member.userId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "ob" });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.member.role).toBe("ob");
  });

  // Team Lead追加（2026-07-30）: DELETEの409だけでは「チームを管理不能にさせない」という
  // ADR-013決定6の不変条件を守れない。最後のadminを降格できてしまうと、招待コードの発行も
  // ロール変更も誰もできないチームが残り、加入は招待コード経由のみなので外からの復旧経路も無い。
  test("最後のadminを降格しようとすると409。別のadminを立ててからなら降格できる", async () => {
    const admin = await registerUser("patch-lastadmin");
    const member = await registerUser("patch-lastadmin-2");
    const { slug, inviteCode } = await createTeam(admin.token, "lastadmin");

    await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({ inviteCode });

    // 自分が唯一のadminである状態で自分を降格 → 409
    const demoteSelf = await request(getServer())
      .patch(`/api/teams/${slug}/members/${admin.userId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "member" });
    expect(demoteSelf.status).toBe(409);

    // 2人目のadminを立ててから同じ操作 → 通る（adminが1人残るため不変条件は壊れない）
    const promote = await request(getServer())
      .patch(`/api/teams/${slug}/members/${member.userId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "admin" });
    expect(promote.status).toBe(200);

    const demoteAgain = await request(getServer())
      .patch(`/api/teams/${slug}/members/${admin.userId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "member" });
    expect(demoteAgain.status).toBe(200);
    expect(demoteAgain.body.member.role).toBe("member");
  });

  // admin→adminのPATCH（実質no-op）が最後のadminガードに誤爆しないこと。
  // ガード条件を `target.role === "admin"` だけにすると、唯一のadminのroleをadminのまま
  // 送り直すだけで409になり、管理不能化と無関係な操作を塞いでしまう。
  test("唯一のadminをadminのままPATCHしても409にならない", async () => {
    const admin = await registerUser("patch-noop-admin");
    const { slug } = await createTeam(admin.token, "noopadmin");

    const res = await request(getServer())
      .patch(`/api/teams/${slug}/members/${admin.userId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.member.role).toBe("admin");
  });
});
