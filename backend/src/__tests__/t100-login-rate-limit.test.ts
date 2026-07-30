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
//
// implementer (2026-07-28, T-100 404調査): フルスイート実行時にごく低頻度(観測は数十回に1回)で
// 「同一emailへの連続失敗」テストの1回目のログインが401ではなく404を返すflakyが見つかった。
// auth.tsのPOST /loginは429/400/401/200しか返せず、404を返すコードパスは存在しない
// （テスト直前にreq到達ログ・app末尾の未マッチ捕捉ログを仕込んで検証済み。両方とも
// 「リクエストはauthRouterに到達し、app全体の想定外フォールバックには落ちていない」ことを示した
// ＝アプリケーションコード側に404を返す分岐は無い）。単独ファイル実行・2ファイル同時実行では
// 40回超再現せず、フルスイート(14ファイル)実行時のみ発生したことから、原因はこのテストの
// ロジックではなく実行環境側にあると判断した。
// supertestの`request(app)`は呼び出しのたびに`http.createServer(app)`で新しいephemeralサーバを
// listen(0)し、レスポンス後にcloseする（node_modules/supertest/lib/test.js）。このファイルだけで
// 1回のフルスイート実行につき約50回、他ファイルと合わせるとフルスイート全体で数百回のサーバ生成/
// 破棄が発生し、フルスイートでしか再現しない・「登録直後の初回ログイン」という短い間隔の連続呼び出しで
// しか観測されない、という条件と整合する（サーバ生成/破棄が薄い間隔で積み重なるほど、
// 稀なポート/ソケットの回収タイミング起因の応答不整合が起きやすくなるという仮説）。
// 断定はできなかった（Team Lead裁定: 10回連続検証は別途実施）ため、対策はこのファイル内で
// サーバ生成回数を1回に減らす、副作用の少ない緩和策にとどめる。本番コード・他テストファイルには
// 触れない。
import request from "supertest";
import { setupTestServer } from "./helpers/testServer";
import { _resetAuthRateLimiterForTests } from "../lib/rateLimiter";

const PASSWORD = "password123";

// implementer (Team Lead指示・テスト基盤改善, 2026-07-28): 個別のbeforeAll/afterAllによるサーバ管理はhelpers/testServer.tsへ
// 集約した（下記getServer参照）。上記の調査経緯コメントは資産として残す。
const getServer = setupTestServer();

async function registerUser(tag: string): Promise<{ email: string }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `${unique}@example.com`;
  const res = await request(getServer())
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
      const res = await request(getServer())
        .post("/api/auth/login")
        .send({ email: user.email, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    }
  });

  test("同一emailへの連続失敗は10回まで許容し、11回目の試行で429になる", async () => {
    const { email } = await registerUser("bruteforce-target");

    for (let i = 0; i < 10; i++) {
      const res = await request(getServer())
        .post("/api/auth/login")
        .send({ email, password: "wrong-password" });
      expect(res.status).toBe(401);
    }

    const eleventh = await request(getServer())
      .post("/api/auth/login")
      .send({ email, password: "wrong-password" });
    expect(eleventh.status).toBe(429);

    // 正しいパスワードでも、429の間はブロックされたまま（枠が空くまで通らない）
    const correctButBlocked = await request(getServer())
      .post("/api/auth/login")
      .send({ email, password: PASSWORD });
    expect(correctButBlocked.status).toBe(429);
  });

  test("ログイン成功はカウントを消費しない（15回連続成功しても429にならない）", async () => {
    const { email } = await registerUser("repeated-success");

    for (let i = 0; i < 15; i++) {
      const res = await request(getServer())
        .post("/api/auth/login")
        .send({ email, password: PASSWORD });
      expect(res.status).toBe(200);
    }
  });
});
