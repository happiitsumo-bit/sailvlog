// implementer (T-101, 2026-07-28): supertestの`request(app)`はNode組み込みhttpの`http.createServer(app)`から
// `listen(0)`まで呼び出し1回ごとに新規ephemeralサーバを生成し、応答後にcloseする（node_modules/supertest/lib/test.js）。
// この生成/破棄がテストスイート全体で密集すると、低頻度でリクエストがアプリのルートハンドラに到達しないまま
// 応答が返るレース（症状は常に「期待したステータスの代わりに404」）が起きることをt31/t100で確定済み
// （詳細な調査記録は各ファイルのコメント、および resetDbHook.ts の調査記録を参照——資産として残す）。
//
// t31・t100はファイル内で個別に「beforeAllで実サーバを1つ立てる」対処を入れて解消したが、
// 同じ問題は`request(app)`を使う他のテストファイルでも同型で再発しうる（実際t12で再発した）。
// このヘルパーはその対処を全ファイル共通化する。使い方:
//
//   import { setupTestServer } from "./helpers/testServer";
//   const getServer = setupTestServer();
//   ...
//   const res = await request(getServer()).get("/api/health");
//
// jestのbeforeAll/afterAllはファイルのトップレベル（またはdescribeブロック直下）でしか
// 登録できないため、この関数はテストファイル側から呼ばれた時点でbeforeAll/afterAllを
// 登録し、実サーバへの参照を返すgetterを渡す（サーバ自体はbeforeAll実行後にしか
// 存在しないため、呼び出し時点ではなく遅延評価で参照する）。
import type { Server } from "http";
import app from "../../index";

export function setupTestServer(): () => Server {
  let server: Server | undefined;

  beforeAll(() => {
    server = app.listen(0);
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => (err ? reject(err) : resolve()));
    });
  });

  return () => {
    if (!server) {
      throw new Error("setupTestServer(): beforeAllが実行される前にサーバへアクセスしようとしました");
    }
    return server;
  };
}
