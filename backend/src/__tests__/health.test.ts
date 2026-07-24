// qa-engineer (T-90): テスト基盤そのものの疎通確認。
// これが落ちる場合、個別テストの失敗原因を疑う前にDB/env/jest設定を疑うこと。
import request from "supertest";
import app from "../index";

describe("テスト基盤の疎通", () => {
  test("GET /api/health は200を返す", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
