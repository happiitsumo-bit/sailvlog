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
import prisma from "../database";
import {
  _resetJoinRateLimiterForTests,
  _resetCreateTeamRateLimiterForTests,
  checkCreateTeamUserRateLimit,
  checkCreateTeamIpRateLimit,
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

// M4-01 (implementer, 2026-08-01): REVIEW-4.mdの回帰テスト。
// POST /api/teamsに流量制限が無く、registerが開放制のため1アカウントでTeam行を無限生成できた。
describe("M4-01: POST /api/teams のレート制限", () => {
  test("userId単位で5回まで許可し、6回目は429（checkCreateTeamUserRateLimit単体）", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 5; i++) {
      expect(checkCreateTeamUserRateLimit(999001, now)).toBe(true);
    }
    expect(checkCreateTeamUserRateLimit(999001, now)).toBe(false);
    // 60分経過後は新しいウィンドウとして扱われ、再び許可される
    expect(checkCreateTeamUserRateLimit(999001, now + 60 * 60 * 1000)).toBe(true);
  });

  test("IP単位で20回まで許可し、21回目は429（checkCreateTeamIpRateLimit単体）", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 20; i++) {
      expect(checkCreateTeamIpRateLimit("unit-test-create-ip", now)).toBe(true);
    }
    expect(checkCreateTeamIpRateLimit("unit-test-create-ip", now)).toBe(false);
  });

  test("POST /api/teams が実際にレート制限され、429を返す（userId単位を5回消費してから6回目を叩く）", async () => {
    const creator = await registerUser("create-rate-limit");
    for (let i = 0; i < 4; i++) {
      checkCreateTeamUserRateLimit(creator.userId);
    }

    // 5回目（=このcreateTeam呼び出しが5回目の消費）は成功する
    await createTeam(creator.token, "create-rate-5th");

    // 6回目は429
    const unique = `create-rate-over-${Date.now()}`;
    const overLimit = await request(getServer())
      .post("/api/teams")
      .set("Authorization", `Bearer ${creator.token}`)
      .send({ name: `T103テストチーム-${unique}`, slug: `t103-${unique}` });
    expect(overLimit.status).toBe(429);
  });

  test("通常のチーム作成（レート制限内）は影響を受けない", async () => {
    const creator = await registerUser("create-rate-normal");
    const res = await createTeam(creator.token, "create-rate-normal");
    expect(res.slug).toContain("t103-create-rate-normal");
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

  // m4-01 (Minor, REVIEW-4.md): 同時join（ダブルクリック）でP2002 → 500になっていた回帰ガード。
  // 2リクエストを同時に送っても両方とも冪等に200で返り、片方だけメンバー行が作られること。
  test("同時に2回joinしても両方冪等に200を返す（P2002を500にしない）", async () => {
    const admin = await registerUser("concurrent-join-admin");
    const joiner = await registerUser("concurrent-join-member");
    const { slug, inviteCode } = await createTeam(admin.token, "concurrent-join");

    const [first, second] = await Promise.all([
      request(getServer())
        .post("/api/teams/join")
        .set("Authorization", `Bearer ${joiner.token}`)
        .send({ inviteCode }),
      request(getServer())
        .post("/api/teams/join")
        .set("Authorization", `Bearer ${joiner.token}`)
        .send({ inviteCode }),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.team.slug).toBe(slug);
    expect(second.body.team.slug).toBe(slug);

    const detail = await request(getServer())
      .get(`/api/teams/${slug}`)
      .set("Authorization", `Bearer ${admin.token}`);
    const memberRows = detail.body.members.filter((m: { userId: number }) => m.userId === joiner.userId);
    expect(memberRows.length).toBe(1);
  });

  // m4-03 (Minor, REVIEW-4.md): ADR-013決定5のレート制限に429の回帰テストが無かった。
  test("不正コード11回目は429（userId単位10回/60秒）", async () => {
    const joiner = await registerUser("join-rate-limit-user");
    for (let i = 0; i < 10; i++) {
      const res = await request(getServer())
        .post("/api/teams/join")
        .set("Authorization", `Bearer ${joiner.token}`)
        .send({ inviteCode: "this-code-does-not-exist" });
      expect(res.status).toBe(404);
    }
    const eleventh = await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${joiner.token}`)
      .send({ inviteCode: "this-code-does-not-exist" });
    expect(eleventh.status).toBe(429);
  });

  test("成功したjoinはレート制限を消費しない（10回連続で成功しても429にならない）", async () => {
    const admin = await registerUser("join-rate-success-admin");
    const { inviteCode } = await createTeam(admin.token, "join-rate-success");
    const joiner = await registerUser("join-rate-success-member");

    for (let i = 0; i < 10; i++) {
      const res = await request(getServer())
        .post("/api/teams/join")
        .set("Authorization", `Bearer ${joiner.token}`)
        .send({ inviteCode });
      // 初回は新規加入、以降は冪等な既加入 → いずれも200（失敗ではないので消費されない）
      expect(res.status).toBe(200);
    }
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

// C-06回帰（Issue #39）: count()→update()/delete()が非トランザクションだと、adminが2人のときに
// 2つの降格/削除リクエストが同時に来て両方が「adminCount<=1ではない」を通過し、
// adminが0人のチームが残ってしまう。Serializableトランザクションで直したことの検証として、
// 「同時実行後もadminが必ず1人以上残る」という不変条件を固定する
// （並行実行の勝敗自体はDBのスケジューリング依存で決定的ではないため、それはテストしない）。
describe("C-06: PATCH/DELETEの同時実行でもadminが0人にならない", () => {
  async function makeTwoAdminTeam(tag: string) {
    const admin = await registerUser(`${tag}-admin`);
    const admin2 = await registerUser(`${tag}-admin2`);
    const { slug, inviteCode } = await createTeam(admin.token, tag);

    await request(getServer())
      .post("/api/teams/join")
      .set("Authorization", `Bearer ${admin2.token}`)
      .send({ inviteCode });

    const promote = await request(getServer())
      .patch(`/api/teams/${slug}/members/${admin2.userId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "admin" });
    expect(promote.status).toBe(200);

    return { slug, admin, admin2 };
  }

  test("2人のadminを同時にPATCH降格させても、admin0人にはならない", async () => {
    const { slug, admin, admin2 } = await makeTwoAdminTeam("c06-patch");

    const [res1, res2] = await Promise.all([
      request(getServer())
        .patch(`/api/teams/${slug}/members/${admin.userId}`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ role: "member" }),
      request(getServer())
        .patch(`/api/teams/${slug}/members/${admin2.userId}`)
        .set("Authorization", `Bearer ${admin2.token}`)
        .send({ role: "member" }),
    ]);

    expect([res1.status, res2.status].every((s) => s === 200 || s === 409)).toBe(true);
    expect([res1.status, res2.status].filter((s) => s === 200).length).toBeLessThanOrEqual(1);

    const remainingAdmins = await prisma.teamMember.count({ where: { role: "admin", team: { slug } } });
    expect(remainingAdmins).toBeGreaterThanOrEqual(1);
  });

  test("2人のadminを同時にDELETEしても、admin0人にはならない", async () => {
    const { slug, admin, admin2 } = await makeTwoAdminTeam("c06-delete");

    const [res1, res2] = await Promise.all([
      request(getServer())
        .delete(`/api/teams/${slug}/members/${admin.userId}`)
        .set("Authorization", `Bearer ${admin.token}`),
      request(getServer())
        .delete(`/api/teams/${slug}/members/${admin2.userId}`)
        .set("Authorization", `Bearer ${admin2.token}`),
    ]);

    expect([res1.status, res2.status].every((s) => s === 204 || s === 409)).toBe(true);
    expect([res1.status, res2.status].filter((s) => s === 204).length).toBeLessThanOrEqual(1);

    const remainingAdmins = await prisma.teamMember.count({ where: { role: "admin", team: { slug } } });
    expect(remainingAdmins).toBeGreaterThanOrEqual(1);
  });
});
