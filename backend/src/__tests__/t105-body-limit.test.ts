// レビュー指摘（2026-08-04・PR #53）の回帰:
//   ① 上限超過が 500 に化けていた（body-parser の entity.too.large をグローバル
//      エラーハンドラが一律500へ変換していたため、「大きすぎる」ことが伝わらず
//      サーバ障害と区別できなかった）
//   ② express.json が認証より前に動くため、上限を24MBに上げると未認証の第三者でも
//      24MBの本文をパースさせられた（登録が誰でも通るのでメモリ負荷の入口になる）
import request from "supertest";
import { setupTestServer } from "./helpers/testServer";

const getServer = setupTestServer();

async function registerUser(tag: string): Promise<string> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await request(getServer())
    .post("/api/auth/register")
    .send({ username: `u${unique}`.slice(0, 30), email: `${unique}@example.com`, password: "password123" });
  return res.body.token;
}

describe("body上限と認証ゲート（Issue #40 レビュー指摘）", () => {
  test("未認証は本文を読まずに401（署名ゲートがexpress.jsonより前にある）", async () => {
    const res = await request(getServer()).post("/api/sessions").send({ title: "x" });
    expect(res.status).toBe(401);
  });

  test("署名が壊れたトークンも401（本文の大小によらない）", async () => {
    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", "Bearer not.a.valid.jwt")
      .send({ title: "x" });
    expect(res.status).toBe(401);
  });

  test("認証済みで上限を超えた本文は413（500ではない）", async () => {
    const token = await registerUser("t105");
    // 24MBを超える本文。rawGpxに巨大文字列を入れて上限超過を起こす。
    const huge = "x".repeat(25 * 1024 * 1024);
    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ title: "too big", tracks: [{ rawGpx: huge }] }));
    expect(res.status).toBe(413);
    expect(res.body.error).toContain("大きすぎます");
  }, 60000);

  // T-31(ADR-007)の設計を壊していないことの確認。ゲートを足したとき実際に壊して検出した回帰。
  test("GETは署名ゲートを素通しする: 未認証の GET /api/tracks/:id/gpx は401ではなく404", async () => {
    const res = await request(getServer()).get("/api/tracks/999999/gpx");
    expect(res.status).toBe(404);
  });

  test("壊れたJSONは400（500ではない）", async () => {
    const token = await registerUser("t105-bad");
    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send("{ this is not json");
    expect(res.status).toBe(400);
  });
});
