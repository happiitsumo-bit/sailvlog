// T-100 (implementer, 2026-07-28): REVIEW-backend-3.md B3-01の回帰テスト。
//
// M-04で入れたIP単位10回/60秒のレート制限は、supertestが全リクエストを同一IPで送ることからも
// わかる通り、「部室の共有Wi-Fi/大学NAT配下は全員が同一グローバルIP」という反省会当日の
// 唯一の利用シーンと衝突していた（7/31に11人目以降が全員ログイン不能になるBlocker）。
// B3-01修正でキーをIP中心からemail中心に変え、IP単位は緩いDoSの蓋（60秒60回）に格下げした。
//
// このファイルはその3点を固定する:
//   ①同一IP・異なるemailで11人がログインしても11人目が弾かれない（B3-01の再現条件そのもの）
//   ②同一emailへの連続失敗は10回で打ち止め・11回目が429になる（総当たり対策が生きている）
//   ③ログイン成功はカウントを消費しない（何度成功しても429にならない）
import request from "supertest";
import app from "../index";
import { _resetAuthRateLimiterForTests } from "../lib/rateLimiter";

const PASSWORD = "password123";

async function registerUser(tag: string): Promise<{ email: string }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `${unique}@example.com`;
  const res = await request(app)
    .post("/api/auth/register")
    .send({ username: `u${unique}`.slice(0, 30), email, password: PASSWORD });
  expect(res.status).toBe(201);
  return { email };
}

beforeEach(() => {
  _resetAuthRateLimiterForTests();
});

describe("T-100 B3-01: login レート制限のキー設計", () => {
  test("同一IP・異なるemailで11人がログインしても、正当な11人目が429で弾かれない（supertestは全リクエスト同一IP）", async () => {
    const users = [];
    for (let i = 0; i < 11; i++) {
      users.push(await registerUser(`shared-ip-${i}`));
    }

    for (const user of users) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    }
  });

  test("同一emailへの連続失敗は10回まで許容し、11回目の試行で429になる", async () => {
    const { email } = await registerUser("bruteforce-target");

    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "wrong-password" });
      expect(res.status).toBe(401);
    }

    const eleventh = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "wrong-password" });
    expect(eleventh.status).toBe(429);

    // 正しいパスワードでも、429の間はブロックされたまま（枠が空くまで通らない）
    const correctButBlocked = await request(app)
      .post("/api/auth/login")
      .send({ email, password: PASSWORD });
    expect(correctButBlocked.status).toBe(429);
  });

  test("ログイン成功はカウントを消費しない（15回連続成功しても429にならない）", async () => {
    const { email } = await registerUser("repeated-success");

    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email, password: PASSWORD });
      expect(res.status).toBe(200);
    }
  });
});
