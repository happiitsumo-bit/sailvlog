// T-90 (qa-engineer): REVIEW.md「テスト・CIの評価」で名指しされた未カバー経路の追加分。
// 対象: ①部内APIからのpublicViewCount漏洩（一覧側）②セッション削除のカスケード完全性
// （Track/Annotation両方）③GET /api/sessions 一覧の認可（非TeamMemberは403）
// ④例外発生時のレスポンスにスタックトレース/内部パス/SQLが含まれないこと ⑤マスアサインメント
// （呼び出し側が制御すべきでないフィールドをボディに混ぜても反映されないこと）。
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
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T97テストチーム" },
  });
}

async function addMember(userId: number, teamId: number, role: "member" | "admin" = "member") {
  return prisma.teamMember.create({ data: { userId, teamId, role } });
}

async function createSessionAsMember(): Promise<{
  sessionId: number;
  teamId: number;
  uploader: { userId: number; token: string };
  durationSec: number;
}> {
  const uploader = await registerUser("uploader");
  const team = await createTeam("s");
  await addMember(uploader.userId, team.id);
  const res = await request(getServer())
    .post("/api/sessions")
    .set("Authorization", `Bearer ${uploader.token}`)
    .send({ title: "第1回練習", type: "practice", startedAt: "2026-07-24T05:00:00.000Z", durationSec: 3600, teamId: team.id });
  return { sessionId: res.body.session.id, teamId: team.id, uploader, durationSec: res.body.session.durationSec };
}

describe("GET /api/sessions?teamId= (T-90 追加)", () => {
  test("非TeamMemberが他チームのteamIdを指定すると403（IDOR: 一覧経路）", async () => {
    const { teamId } = await createSessionAsMember();
    const outsider = await registerUser("outsider");

    const res = await request(getServer())
      .get(`/api/sessions?teamId=${teamId}`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
  });

  test("未認証(JWTなし)は401", async () => {
    const { teamId } = await createSessionAsMember();
    const res = await request(getServer()).get(`/api/sessions?teamId=${teamId}`);
    expect(res.status).toBe(401);
  });

  // REVIEW.md R-02 / TASKS.md記載: 元々はTeam Lead裁定「GET /api/sessions/:id 限定」でpublicViewCount除外を
  // 修正しており、一覧側（GET /api/sessions?teamId=）はselect無しのfindManyのままで同じ非KPI項目が
  // 漏れていた（バグ再現テストとして「現状FAIL」の名前で追加していた）。
  // m3-03修正（2026-07-28, REVIEW-backend-3.md）: M-02修正で一覧側もselectホワイトリストに揃え済みのため
  // 現在はPASSする。テスト名/コメントが「未修正のバグ再現」のまま残っていると次に読む人が誤読するため、
  // 修正済みの回帰テストとして書き直す。
  test("一覧レスポンス(GET /api/sessions?teamId=)にpublicViewCountが含まれない", async () => {
    const { sessionId, teamId, uploader } = await createSessionAsMember();
    // 閲覧数を人為的に発生させておく（0でもキー自体が漏れるかを見るには十分だが、値ありでより明確にする）
    await prisma.session.update({ where: { id: sessionId }, data: { publicViewCount: 3 } });

    const res = await request(getServer())
      .get(`/api/sessions?teamId=${teamId}`)
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("publicViewCount");
  });
});

describe("DELETE /api/sessions/:id カスケード削除の完全性 (T-90 追加)", () => {
  test("セッション削除でTrackとAnnotationの両方が消える（Trackのみの既存確認をAnnotationにも拡張）", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const trackRes = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({
        boatLabel: "4423 田中/佐藤",
        startSec: 0,
        pointCount: 1,
        gridJson: { lat: [35.3], lon: [139.48], gaps: [] },
        rawGpx: "<gpx>x</gpx>",
      });
    await request(getServer())
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 5, body: "カスケード確認用注釈" });

    const trackId = trackRes.body.track.id as number;

    const res = await request(getServer())
      .delete(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(res.status).toBe(204);

    const remainingTracks = await prisma.track.findMany({ where: { sessionId } });
    const remainingAnnotations = await prisma.annotation.findMany({ where: { sessionId } });
    const remainingTrackById = await prisma.track.findUnique({ where: { id: trackId } });
    expect(remainingTracks).toHaveLength(0);
    expect(remainingAnnotations).toHaveLength(0);
    expect(remainingTrackById).toBeNull();
  });

  test("公開中(unlisted)セッションを削除すると、以後は公開URLも同一の一律404扱いになる", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const publishRes = await request(getServer())
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "削除前提の公開" });
    const slug = publishRes.body.publicSlug as string;

    const del = await request(getServer())
      .delete(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(del.status).toBe(204);

    const publicRes = await request(getServer()).get(`/api/public/sessions/${slug}`);
    const nonExistentRes = await request(getServer()).get(`/api/public/sessions/totally-different-nonexistent`);
    expect(publicRes.status).toBe(404);
    expect(publicRes.body).toEqual(nonExistentRes.body);
  });
});

describe("エラー時の内部情報非漏洩 (T-90 追加, T-96のグローバルエラーハンドラを深掘り)", () => {
  test("DB例外発生時の500レスポンスに、スタックトレース・SQL文・ファイルパスが含まれない", async () => {
    const { userId, token } = await registerUser("errleak");
    const team = await createTeam("errleak");
    await prisma.teamMember.create({ data: { userId, teamId: team.id, role: "member" } });

    const spy = jest
      .spyOn(prisma.session, "findMany")
      .mockRejectedValueOnce(new Error("simulated DB failure at /app/src/database.ts:42 SELECT * FROM sessions"));
    const consoleErrSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await request(getServer())
      .get(`/api/sessions?teamId=${team.id}`)
      .set("Authorization", `Bearer ${token}`);

    spy.mockRestore();
    consoleErrSpy.mockRestore();

    expect(res.status).toBe(500);
    const raw = JSON.stringify(res.body);
    // レスポンスは固定の汎用メッセージのみであること（index.tsのグローバルエラーハンドラの契約）
    expect(res.body).toEqual({ error: "Internal Server Error" });
    expect(raw).not.toContain("simulated DB failure");
    expect(raw).not.toContain(".ts:");
    expect(raw).not.toContain("SELECT");
    expect(raw.toLowerCase()).not.toContain("at object.");
    expect(raw.toLowerCase()).not.toContain("prisma");
  });
});

describe("マスアサインメント防御 (T-90 追加)", () => {
  test("POST /api/sessions: uploaderId/publicViewCount/publicSlug/visibilityを混ぜても無視され、意図した既定値のみ保存される", async () => {
    const user = await registerUser("mass1");
    const other = await registerUser("mass1-other");
    const team = await createTeam("mass1");
    await addMember(user.userId, team.id);

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send({
        title: "マスアサインメント確認",
        startedAt: "2026-07-24T05:00:00.000Z",
        durationSec: 60,
        teamId: team.id,
        uploaderId: other.userId, // 他人になりすまそうとする
        publicViewCount: 999999,
        publicSlug: "attacker-chosen-slug",
        visibility: "public",
      });

    expect(res.status).toBe(201);
    expect(res.body.session.uploaderId).toBe(user.userId); // 呼び出しトークンの本人のまま
    expect(res.body.session.visibility).toBe("team"); // 既定値のまま(公開はpublish経由のみ)

    const stored = await prisma.session.findUnique({ where: { id: res.body.session.id } });
    expect(stored?.uploaderId).toBe(user.userId);
    expect(stored?.publicViewCount).toBe(0);
    expect(stored?.publicSlug).toBeNull();
    expect(stored?.visibility).toBe("team");
  });

  test("PATCH /api/sessions/:id: visibility/publicSlug/publishedAtを混ぜても更新対象は title/notes/marks/legs のみ", async () => {
    const { sessionId, uploader } = await createSessionAsMember();

    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({
        title: "更新後タイトル",
        visibility: "public",
        publicSlug: "attacker-chosen-slug-2",
        publishedAt: "2020-01-01T00:00:00.000Z",
      });

    expect(res.status).toBe(200);
    expect(res.body.session.title).toBe("更新後タイトル");

    const stored = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(stored?.visibility).toBe("team");
    expect(stored?.publicSlug).toBeNull();
    expect(stored?.publishedAt).toBeNull();
  });
});
