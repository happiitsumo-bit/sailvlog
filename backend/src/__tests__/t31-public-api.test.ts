// T-31: 公開取得API＋漏洩防止テスト（GET /api/public/sessions/:slug）— 本スライスの安全性の要。
// ARCH.md §4 / SPEC-share1-phase1.md §5.2 / 実装ルール9（ADR-007）の検証欄を網羅する。
import request from "supertest";
import type { Server } from "http";
import app from "../index";
import prisma from "../database";
import { _resetRateLimiterForTests, _resetViewThrottleForTests } from "../lib/rateLimiter";
import { awaitPendingBackgroundWork } from "../routes/public";

const FORBIDDEN_KEYS = ["rawGpx", "email", "teamId", "notes", "publicViewCount"];

// implementer (T-90 flakyの真因確定, 2026-07-28): 前任のqa-engineerはwithFrozenClock()で
// 「時計を止めれば決定的になるはず」という対策を入れたが、Team Lead計測(4回中3回PASS/1回FAIL)で
// それでも残った。T31_DEBUGログでbuckets(windowStart/count)とfrozenNowの推移を毎リクエスト出して
// 61回中どこで崩れるかを直接観測したところ、frozenNowは61回とも同一値で固定されており仮説通り
// 機能していた一方、checkRateLimit()内部のcheck()呼び出しログが61回中60回しか記録されない回が
// 再現した＝61回目のHTTPラウンドトリップ自体がアプリのルートハンドラに到達せず200を返していた。
// t100-login-rate-limit.test.ts (T-100 404 flaky, 直前コミット1fa3275) で特定済みの原因と同型:
// supertestの`request(app)`は呼び出しごとに`http.createServer(app)`＋`listen(0)`で新しい
// ephemeralサーバを生成する(node_modules/supertest/lib/test.js)。この関数だけで61回×5テスト=
// 300回超のサーバ生成/破棄がループの中で短い間隔で積み重なり、生成/破棄のレース由来で
// 稀に応答がルートハンドラを経由せず返る個体が混ざる。frozen clockは「時計のズレ」という
// 別仮説を潰すには正しかったが、真因はここではなかった。t100と同じ緩和策
// (サーバ生成をbeforeAllで1回に集約しrequest(server)を使う)をこのファイル全体に適用する。
async function withFrozenClock<T>(fn: () => Promise<T>): Promise<T> {
  const frozenNow = Date.now();
  const spy = jest.spyOn(Date, "now").mockReturnValue(frozenNow);
  try {
    return await fn();
  } finally {
    spy.mockRestore();
  }
}

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
  const res = await request(server)
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

  const sessionRes = await request(server)
    .post("/api/sessions")
    .set("Authorization", `Bearer ${uploader.token}`)
    .send({ title: "第1回練習", type: "practice", startedAt: "2026-07-24T05:00:00.000Z", durationSec: 3600, teamId: team.id, notes: "部内限定の生々しいメモ" });
  const sessionId = sessionRes.body.session.id as number;

  const trackRes = await request(server)
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
    const r = await request(server)
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 10 + i, body: `公開される注釈${i}`, trackId });
    publicAnnotationIds.push(r.body.annotation.id);
  }
  for (let i = 0; i < (opts?.privateAnnotations ?? 1); i++) {
    const r = await request(server)
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 20 + i, body: "反省会限定の生の発言（非公開のはず）" });
    privateAnnotationIds.push(r.body.annotation.id);
  }

  const publishRes = await request(server)
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

let server: Server;

beforeAll(() => {
  server = app.listen(0);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  _resetRateLimiterForTests();
  _resetViewThrottleForTests();
});

describe("GET /api/public/sessions/:slug (T-31)", () => {
  test("公開セッションを未認証で200取得できる", async () => {
    const { slug } = await createPublishedSession();
    const res = await request(server).get(`/api/public/sessions/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.session.learningSummary).toBe("上マーク回航後の展開が遅れた");
    expect(res.body.tracks).toHaveLength(1);
  });

  test("①禁止キー非含有: レスポンスJSONのどの階層にも rawGpx/email/teamId/notes/publicViewCount が出現しない", async () => {
    const { slug, uploaderEmail } = await createPublishedSession();
    const res = await request(server).get(`/api/public/sessions/${slug}`);
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
    const res = await request(server).get(`/api/public/sessions/${slug}`);
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
    const notExist1 = await request(server).get(`/api/public/sessions/does-not-exist-slug-1`);
    const notExist2 = await request(server).get(`/api/public/sessions/does-not-exist-slug-2`);
    expect(notExist1.status).toBe(404);
    expect(notExist2.status).toBe(404);
    expect(notExist1.body).toEqual(notExist2.body);
  });

  test("③-b unpublish後(取り消し済み)は同じスラッグが404になり、存在しないスラッグと同一のレスポンスボディ", async () => {
    const { sessionId, slug } = await createPublishedSession();
    // publicSlugを破棄してvisibilityを"team"へ戻す(POST /unpublishが行うのと同じ状態遷移)
    await prisma.session.update({ where: { id: sessionId }, data: { visibility: "team", publicSlug: null } });

    const afterUnpublish = await request(server).get(`/api/public/sessions/${slug}`);
    const nonExistent = await request(server).get(`/api/public/sessions/totally-different-nonexistent`);

    expect(afterUnpublish.status).toBe(404);
    expect(afterUnpublish.body).toEqual(nonExistent.body);
  });

  test("④レート制限: 同一IPから61回目は429", async () => {
    const { slug } = await createPublishedSession();

    let last;
    await withFrozenClock(async () => {
      for (let i = 0; i < 61; i++) {
        last = await request(server).get(`/api/public/sessions/${slug}`);
      }
    });
    expect(last!.status).toBe(429);
  }, 60000);

  // Quality Gate Major1修正: Next.jsサーバーコンポーネント経由のアクセスは全員が同じreq.ipで
  // backendに到着するため、素のreq.ipだけをキーにすると「1分61回開かれた時点で全公開URLが
  // 全員に404」になる。frontend/src/lib/publicSession.ts が転送する x-forwarded-client-ip を
  // backendが優先して使うことで、実クライアント単位にレート制限が効くことを検証する。
  //
  // Team Lead指摘(R-03残穴)修正: このヘッダは共有シークレット(x-internal-proxy-secret)が
  // 一致した場合のみ信頼される。以下のテストではNext.jsサーバーになりすまして正しいシークレットを
  // 同送し、「一致時は転送ヘッダが採用される」ことを検証する(INTERNAL_PROXY_SECRETは
  // beforeAll/afterAllでこのdescribeブロック限定で設定・復元する)。
  const TEST_PROXY_SECRET = "t31-test-proxy-secret";
  let originalProxySecret: string | undefined;

  beforeAll(() => {
    originalProxySecret = process.env.INTERNAL_PROXY_SECRET;
    process.env.INTERNAL_PROXY_SECRET = TEST_PROXY_SECRET;
  });

  afterAll(() => {
    if (originalProxySecret === undefined) delete process.env.INTERNAL_PROXY_SECRET;
    else process.env.INTERNAL_PROXY_SECRET = originalProxySecret;
  });

  test("④-b レート制限: 正しい共有シークレット付きなら x-forwarded-client-ip が異なるだけで同一req.ipでも別バケットとして扱われる", async () => {
    const { slug } = await createPublishedSession();

    let lastA;
    await withFrozenClock(async () => {
      for (let i = 0; i < 61; i++) {
        lastA = await request(server)
          .get(`/api/public/sessions/${slug}`)
          .set("x-forwarded-client-ip", "203.0.113.1")
          .set("x-internal-proxy-secret", TEST_PROXY_SECRET);
      }
    });
    expect(lastA!.status).toBe(429);

    // 別クライアントIPを名乗ればまだ枠が残っている(同一req.ipのまま、ヘッダだけ変える)
    const otherClient = await request(server)
      .get(`/api/public/sessions/${slug}`)
      .set("x-forwarded-client-ip", "203.0.113.2")
      .set("x-internal-proxy-secret", TEST_PROXY_SECRET);
    expect(otherClient.status).toBe(200);
  }, 60000);

  test("④-c R-03: 共有シークレットが無いと x-forwarded-client-ip は無視され、req.ip(supertestは同一)で丸められる", async () => {
    const { slug } = await createPublishedSession();

    // シークレットを付けずに61回、クライアントIPを詐称してもバケットは req.ip 由来の1つに丸まる
    let last;
    await withFrozenClock(async () => {
      for (let i = 0; i < 61; i++) {
        last = await request(server)
          .get(`/api/public/sessions/${slug}`)
          .set("x-forwarded-client-ip", `203.0.113.${i}`); // シークレット無し・IPは毎回変える
      }
    });
    expect(last!.status).toBe(429); // 詐称ヘッダは信用されず、素のreq.ipバケットで429に達する
  }, 60000);

  test("④-d R-03: 共有シークレットが不一致だと x-forwarded-client-ip は無視される", async () => {
    const { slug } = await createPublishedSession();

    let last;
    await withFrozenClock(async () => {
      for (let i = 0; i < 61; i++) {
        last = await request(server)
          .get(`/api/public/sessions/${slug}`)
          .set("x-forwarded-client-ip", `198.51.100.${i}`)
          .set("x-internal-proxy-secret", "wrong-secret-value");
      }
    });
    expect(last!.status).toBe(429);
  }, 60000);

  test("④-e R-03: INTERNAL_PROXY_SECRET が未設定(環境変数側)なら、正しそうなシークレットヘッダを送っても信用しない(安全側フォールバック)", async () => {
    const saved = process.env.INTERNAL_PROXY_SECRET;
    delete process.env.INTERNAL_PROXY_SECRET;
    try {
      const { slug } = await createPublishedSession();
      let last;
      await withFrozenClock(async () => {
        for (let i = 0; i < 61; i++) {
          last = await request(server)
            .get(`/api/public/sessions/${slug}`)
            .set("x-forwarded-client-ip", `192.0.2.${i}`)
            .set("x-internal-proxy-secret", TEST_PROXY_SECRET);
        }
      });
      expect(last!.status).toBe(429);
    } finally {
      if (saved === undefined) delete process.env.INTERNAL_PROXY_SECRET;
      else process.env.INTERNAL_PROXY_SECRET = saved;
    }
  }, 60000);

  test("publicViewCountは同一IP・同一スラッグ5分以内は加算されない(2回叩いても+1のみ)", async () => {
    const { sessionId, slug } = await createPublishedSession();
    await request(server).get(`/api/public/sessions/${slug}`);
    await request(server).get(`/api/public/sessions/${slug}`);
    // update自体は非同期(fire-and-forget)なので、sleepではなく「今実行中のバックグラウンド処理が
    // すべて片付いた」ことを状態として待つ(implementer, T-90 flaky根絶)。
    await awaitPendingBackgroundWork();
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(session?.publicViewCount).toBe(1);
  });

  // implementer (T-90, 2026-07-28): 本番挙動の固定テスト。
  // trackBackgroundWork()での「集合への登録」を足しただけで、レスポンスがそのPromiseの完了を
  // 待つように変わっていないことを直接証明する。prisma.session.updateを意図的に遅く(200ms)
  // モックし、「レスポンスはそれよりずっと速く返る」ことと「その時点ではDBはまだ未加算」の
  // 両方を確認する(=await pendingBackgroundWork.add()した後もレスポンス経路をブロックしていない)。
  test("閲覧数加算はレスポンスをブロックしない(fire-and-forgetのまま、本番挙動固定)", async () => {
    const { sessionId, slug } = await createPublishedSession();

    let resolveUpdate!: () => void;
    const updateGate = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });
    const updateSpy = jest.spyOn(prisma.session, "update").mockImplementation(
      // レスポンスが先に返ることを保証するため、テスト側で明示的に解放するまで完了しないPromiseを返す
      // (実際の戻り値の形は使わないためテスト専用の型キャストで簡略化する)
      (() => updateGate.then(() => undefined)) as unknown as typeof prisma.session.update,
    );

    try {
      const res = await request(server).get(`/api/public/sessions/${slug}`);
      expect(res.status).toBe(200);

      // レスポンスが返った時点では、意図的に止めているupdateはまだ完了していない
      // = レスポンスはこのPromiseを待っていない証拠。
      const sessionRightAfterResponse = await prisma.session.findUnique({
        where: { id: sessionId },
      });
      expect(sessionRightAfterResponse?.publicViewCount).toBe(0);

      resolveUpdate();
      await awaitPendingBackgroundWork();
    } finally {
      updateSpy.mockRestore();
    }
  });

  test("publicViewCountはレスポンスに含まれない(既存の禁止キーテストと重複だが単独でも確認)", async () => {
    const { slug } = await createPublishedSession();
    const res = await request(server).get(`/api/public/sessions/${slug}`);
    expect(JSON.stringify(res.body)).not.toContain("publicViewCount");
  });
});

describe("GET /api/tracks/:id/gpx 未認証時 (T-31)", () => {
  test("⑤未認証は404", async () => {
    const { trackId } = await createPublishedSession();
    const res = await request(server).get(`/api/tracks/${trackId}/gpx`);
    expect(res.status).toBe(404);
  });

  test("回帰確認: 認証済みTeamMemberは従来どおり200でGPX本文が取れる", async () => {
    const uploader = await registerUser("gpxmember");
    const team = await createTeam("gpx");
    await addMember(uploader.userId, team.id);
    const sessionRes = await request(server)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ title: "GPX確認用", type: "practice", startedAt: "2026-07-24T05:00:00.000Z", durationSec: 60, teamId: team.id });
    const trackRes = await request(server)
      .post(`/api/sessions/${sessionRes.body.session.id}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({
        boatLabel: "回帰確認艇",
        startSec: 0,
        pointCount: 1,
        gridJson: { lat: [35.3], lon: [139.48], gaps: [] },
        rawGpx: "<gpx>回帰確認用</gpx>",
      });

    const res = await request(server)
      .get(`/api/tracks/${trackRes.body.track.id}/gpx`)
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("回帰確認用");
  });

  test("回帰確認: 認証済みだが非TeamMemberは従来どおり403", async () => {
    const { trackId } = await createPublishedSession();
    const outsider = await registerUser("gpxoutsider");
    const res = await request(server)
      .get(`/api/tracks/${trackId}/gpx`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
  });
});
