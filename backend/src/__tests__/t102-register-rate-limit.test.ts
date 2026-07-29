// T-102 (implementer, 2026-07-29): REVIEW-backend-3.md M3-02の回帰テスト。
//
// POST /api/auth/register にはレート制限が無く、bcrypt.hash(cost 12)（compareと同程度に重い）を
// 高頻度で叩けばlibuvスレッドプールが飽和し、反省会中に他のリクエストも巻き込まれて
// 待たされる恐れがあった（M-04がloginに入れたのと同じ脅威に対し、registerだけ無防備だった）。
// 対策はIP単位の固定ウィンドウ（60秒100回。値の根拠はlib/rateLimiter.tsのコメント参照）。
//
// **実HTTPで100回叩いて境界値を確認しない理由**: このマシンでのbcrypt.hash(cost 12)実測は
// 1回=約245ms（このファイル作成時に測定）。100回を1testで直列実行すると約25秒以上かかり、
// jest.config.jsのtestTimeout(15000ms)を超えてタイムアウトする。そこで、
//   ①境界値そのもの（100回目まで許可・101回目で拒否）は`checkRegisterRateLimit`を直接呼ぶ
//     ユニットテストで検証する（実処理コストが無く一瞬で終わる。`now`引数を固定できるため
//     時間経過も待たない）
//   ②route側が実際にこの関数を使って429を返すこと（配線の確認）は、`app.set("trust proxy", 1)`
//     （B3-01で設定済み）によりX-Forwarded-Forヘッダを信頼する性質を利用し、テスト専用の
//     架空IPを`checkRegisterRateLimit`の直接呼び出しで99回分「消費」した状態を作ってから、
//     同じ架空IPを名乗る実HTTPリクエストを2回（100回目=成功、101回目=429）叩くことで確認する
//     （real registerは2回だけなので高速）。
import request from "supertest";
import { setupTestServer } from "./helpers/testServer";
import { checkRegisterRateLimit, _resetRegisterRateLimiterForTests } from "../lib/rateLimiter";

const PASSWORD = "password123";

const getServer = setupTestServer();

function uniquePayload(tag: string) {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    username: `u${unique}`.slice(0, 30),
    email: `${unique}@example.com`,
    password: PASSWORD,
  };
}

beforeEach(() => {
  _resetRegisterRateLimiterForTests();
});

describe("T-102 M3-02: register のIPレート制限", () => {
  test("同一キーで100回まで許可し、101回目で拒否する（checkRegisterRateLimit単体）", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 100; i++) {
      expect(checkRegisterRateLimit("unit-test-ip", now)).toBe(true);
    }
    expect(checkRegisterRateLimit("unit-test-ip", now)).toBe(false);
  });

  test("ウィンドウが経過すればカウントがリセットされる（checkRegisterRateLimit単体）", () => {
    const windowStart = 1_700_000_000_000;
    for (let i = 0; i < 100; i++) {
      expect(checkRegisterRateLimit("unit-test-ip-2", windowStart)).toBe(true);
    }
    expect(checkRegisterRateLimit("unit-test-ip-2", windowStart)).toBe(false);
    // 60秒経過後は新しいウィンドウとして扱われ、再び許可される
    expect(checkRegisterRateLimit("unit-test-ip-2", windowStart + 60_000)).toBe(true);
  });

  test("POST /api/auth/register が実際にレート制限され、429を返す（X-Forwarded-Forで模擬IPを固定）", async () => {
    const fakeIp = "203.0.113.55"; // TEST-NET-3（RFC5737）。実在の割当先ではない
    for (let i = 0; i < 99; i++) {
      checkRegisterRateLimit(fakeIp);
    }

    const hundredth = await request(getServer())
      .post("/api/auth/register")
      .set("X-Forwarded-For", fakeIp)
      .send(uniquePayload("m302-100th"));
    expect(hundredth.status).toBe(201);

    const overLimit = await request(getServer())
      .post("/api/auth/register")
      .set("X-Forwarded-For", fakeIp)
      .send(uniquePayload("m302-over"));
    expect(overLimit.status).toBe(429);
  });

  test("通常の登録（レート制限内）は影響を受けない", async () => {
    const res = await request(getServer())
      .post("/api/auth/register")
      .send(uniquePayload("m302-normal"));
    expect(res.status).toBe(201);
  });
});
