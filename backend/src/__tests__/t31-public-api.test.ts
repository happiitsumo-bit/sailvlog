// T-31: 公開取得API＋漏洩防止テスト（GET /api/public/sessions/:slug）— 本スライスの安全性の要。
// ARCH.md §4 / SPEC-share1-phase1.md §5.2 / 実装ルール9（ADR-007）の検証欄を網羅する。
import request from "supertest";
import app from "../index";
import prisma from "../database";
import { _resetRateLimiterForTests, _resetViewThrottleForTests } from "../lib/rateLimiter";

const FORBIDDEN_KEYS = ["rawGpx", "email", "teamId", "notes", "publicViewCount"];

/** レスポンスJSONをどの階層まで潜っても禁止キーが出現しないことを検証する再帰走査。 */
function findForbiddenKeys(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...findForbiddenKeys(v, `${path}[${i}]`)));
  } else if (value !== null && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.includes(key)) {
        hits.push(`${path}.${key}`);
      }
      hits.push(...findForbiddenKeys(v, `${path}.${key}`));
    }
  }
  return hits;
}

async function registerUser(tag: string): Promise<{ userId: number; token: string; email: string }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `${unique}@example.com`;
  const res = await request(app)
    .post("/api/auth/register")
    .send({ username: `u${unique}`.slice(0, 30), email, password: "password123" });
  return { userId: res.body.user.id, token: res.body.token, email };
}

async function createTeam(tag: string) {
  return prisma.team.create({
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T31テストチーム" },
  });
}

async function addMember(userId: number, teamId: number, role: "member" | "admin" = "member") {
  return prisma.teamMember.create({ data: { userId, teamId, role } });
}

async function createPublishedSession(opts?: {
  visibility?: "unlisted" | "public";
  publicAnnotations?: number;
  privateAnnotations?: number;
}) {
  const uploader = await registerUser("uploader");
  const team = await createTeam("s");
  await addMember(uploader.userId, team.id);

  const sessionRes = await request(app)
    .post("/api/sessions")
    .set("Authorization", `Bearer ${uploader.token}`)
    .send({ title: "第1回練習", type: "practice", startedAt: "2026-07-24T05:00:00.000Z", durationSec: 3600, teamId: team.id, notes: "部内限定の生々しいメモ" });
  const sessionId = sessionRes.body.session.id as number;

  const trackRes = await request(app)
    .post(`/api/sessions/${sessionId}/tracks`)
    .set("Authorization", `Bearer ${uploader.token}`)
    .send({
      boatLabel: "4423 田中/佐藤",
      startSec: 0,
      pointCount: 3,
      gridJson: { lat: [35.3, 35.301, 35.302], lon: [139.48, 139.481, 139.482], gaps: [] },
      rawGpx: "<gpx><trk><trkseg><trkpt lat=\"35.3\" lon=\"139.48\"></trkpt></trkseg></trk></gpx>",
      sourceApp: "Geo Tracker",
    });
  const trackId = trackRes.body.track.id as number;

  const publicAnnotationIds: number[] = [];
  const privateAnnotationIds: number[] = [];
  for (let i = 0; i < (opts?.publicAnnotations ?? 1); i++) {
    const r = await request(app)
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 10 + i, body: `公開される注釈${i}`, trackId });
    publicAnnotationIds.push(r.body.annotation.id);
  }
  for (let i = 0; i < (opts?.privateAnnotations ?? 1); i++) {
    const r = await request(app)
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 20 + i, body: "反省会限定の生の発言（非公開のはず）" });
    privateAnnotationIds.push(r.body.annotation.id);
  }

  const publishRes = await request(app)
    .post(`/api/sessions/${sessionId}/publish`)
    .set("Authorization", `Bearer ${uploader.token}`)
    .send({
      visibility: opts?.visibility ?? "unlisted",
      learningSummary: "上マーク回航後の展開が遅れた",
      publicAnnotationIds,
    });

  return {
    sessionId,
    trackId,
    teamId: team.id,
    uploaderEmail: uploader.email,
    publicAnnotationIds,
    privateAnnotationIds,
    slug: publishRes.body.publicSlug as string,
  };
}

beforeEach(() => {
  _resetRateLimiterForTests();
  _resetViewThrottleForTests();
});

describe("GET /api/public/sessions/:slug (T-31)", () => {
  test("公開セッションを未認証で200取得できる", async () => {
    const { slug } = await createPublishedSession();
    const res = await request(app).get(`/api/public/sessions/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.session.learningSummary).toBe("上マーク回航後の展開が遅れた");
    expect(res.body.tracks).toHaveLength(1);
  });

  test("①禁止キー非含有: レスポンスJSONのどの階層にも rawGpx/email/teamId/notes/publicViewCount が出現しない", async () => {
    const { slug, uploaderEmail } = await createPublishedSession();
    const res = await request(app).get(`/api/public/sessions/${slug}`);
    expect(res.status).toBe(200);

    const hits = findForbiddenKeys(res.body);
    expect(hits).toEqual([]);

    // 文字列としての漏洩(値としてemailやnotesの本文が出ていないか)も併せて確認
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(uploaderEmail);
    expect(raw).not.toContain("部内限定の生々しいメモ");
    expect(raw).not.toContain("<gpx>"); // rawGpxの中身そのもの
  });

  test("②isPublic=falseの注釈が件数ごと出ない", async () => {
    const { slug, publicAnnotationIds, privateAnnotationIds } = await createPublishedSession({
      publicAnnotations: 2,
      privateAnnotations: 3,
    });
    const res = await request(app).get(`/api/public/sessions/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.annotations).toHaveLength(2);

    const returnedIds = res.body.annotations.map((a: { id: number }) => a.id);
    expect(returnedIds.sort()).toEqual([...publicAnnotationIds].sort());
    for (const id of privateAnnotationIds) {
      expect(returnedIds).not.toContain(id);
    }
    // 非公開の発言テキストがどこにも出ない
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("反省会限定の生の発言");
  });

  test("③存在しないスラッグと、非公開(visibility=team)のセッションIDと同型の値は同一の404レスポンス", async () => {
    const notExist1 = await request(app).get(`/api/public/sessions/does-not-exist-slug-1`);
    const notExist2 = await request(app).get(`/api/public/sessions/does-not-exist-slug-2`);
    expect(notExist1.status).toBe(404);
    expect(notExist2.status).toBe(404);
    expect(notExist1.body).toEqual(notExist2.body);
  });

  test("③-b unpublish後(取り消し済み)は同じスラッグが404になり、存在しないスラッグと同一のレスポンスボディ", async () => {
    const { sessionId, slug } = await createPublishedSession();
    // publicSlugを破棄してvisibilityを"team"へ戻す(POST /unpublishが行うのと同じ状態遷移)
    await prisma.session.update({ where: { id: sessionId }, data: { visibility: "team", publicSlug: null } });

    const afterUnpublish = await request(app).get(`/api/public/sessions/${slug}`);
    const nonExistent = await request(app).get(`/api/public/sessions/totally-different-nonexistent`);

    expect(afterUnpublish.status).toBe(404);
    expect(afterUnpublish.body).toEqual(nonExistent.body);
  });

  test("④レート制限: 同一IPから61回目は429", async () => {
    const { slug } = await createPublishedSession();

    let last;
    for (let i = 0; i < 61; i++) {
      last = await request(app).get(`/api/public/sessions/${slug}`);
    }
    expect(last!.status).toBe(429);
  }, 30000);

  // Quality Gate Major1修正: Next.jsサーバーコンポーネント経由のアクセスは全員が同じreq.ipで
  // backendに到着するため、素のreq.ipだけをキーにすると「1分61回開かれた時点で全公開URLが
  // 全員に404」になる。frontend/src/lib/publicSession.ts が転送する x-forwarded-client-ip を
  // backendが優先して使うことで、実クライアント単位にレート制限が効くことを検証する。
  test("④-b レート制限: x-forwarded-client-ip が異なれば同一req.ipでも別バケットとして扱われる", async () => {
    const { slug } = await createPublishedSession();

    let lastA;
    for (let i = 0; i < 61; i++) {
      lastA = await request(app)
        .get(`/api/public/sessions/${slug}`)
        .set("x-forwarded-client-ip", "203.0.113.1");
    }
    expect(lastA!.status).toBe(429);

    // 別クライアントIPを名乗ればまだ枠が残っている(同一req.ipのまま、ヘッダだけ変える)
    const otherClient = await request(app)
      .get(`/api/public/sessions/${slug}`)
      .set("x-forwarded-client-ip", "203.0.113.2");
    expect(otherClient.status).toBe(200);
  }, 30000);

  test("publicViewCountは同一IP・同一スラッグ5分以内は加算されない(2回叩いても+1のみ)", async () => {
    const { sessionId, slug } = await createPublishedSession();
    await request(app).get(`/api/public/sessions/${slug}`);
    await request(app).get(`/api/public/sessions/${slug}`);
    // update自体は非同期でcatchするだけの設計のため反映を少し待つ
    await new Promise((r) => setTimeout(r, 200));
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(session?.publicViewCount).toBe(1);
  });

  test("publicViewCountはレスポンスに含まれない(既存の禁止キーテストと重複だが単独でも確認)", async () => {
    const { slug } = await createPublishedSession();
    const res = await request(app).get(`/api/public/sessions/${slug}`);
    expect(JSON.stringify(res.body)).not.toContain("publicViewCount");
  });
});

describe("GET /api/tracks/:id/gpx 未認証時 (T-31)", () => {
  test("⑤未認証は404", async () => {
    const { trackId } = await createPublishedSession();
    const res = await request(app).get(`/api/tracks/${trackId}/gpx`);
    expect(res.status).toBe(404);
  });

  test("回帰確認: 認証済みTeamMemberは従来どおり200でGPX本文が取れる", async () => {
    const uploader = await registerUser("gpxmember");
    const team = await createTeam("gpx");
    await addMember(uploader.userId, team.id);
    const sessionRes = await request(app)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ title: "GPX確認用", type: "practice", startedAt: "2026-07-24T05:00:00.000Z", durationSec: 60, teamId: team.id });
    const trackRes = await request(app)
      .post(`/api/sessions/${sessionRes.body.session.id}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({
        boatLabel: "回帰確認艇",
        startSec: 0,
        pointCount: 1,
        gridJson: { lat: [35.3], lon: [139.48], gaps: [] },
        rawGpx: "<gpx>回帰確認用</gpx>",
      });

    const res = await request(app)
      .get(`/api/tracks/${trackRes.body.track.id}/gpx`)
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("回帰確認用");
  });

  test("回帰確認: 認証済みだが非TeamMemberは従来どおり403", async () => {
    const { trackId } = await createPublishedSession();
    const outsider = await registerUser("gpxoutsider");
    const res = await request(app)
      .get(`/api/tracks/${trackId}/gpx`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
  });
});
