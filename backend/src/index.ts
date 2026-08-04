import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

import { assertJwtSecretConfigured } from "./lib/assertJwtSecretConfigured";
import { requireBearerSignature } from "./middleware/auth";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import boatTypesRouter from "./routes/boatTypes";
import sailorsRouter from "./routes/sailors";
import teamsRouter from "./routes/teams";
import sessionsRouter from "./routes/sessions";
import tracksRouter from "./routes/tracks";
import annotationsRouter from "./routes/annotations";
import publicRouter from "./routes/public";

// v3ピボット（2026-07-24, ADR-003）: 凍結対象ルート。
// 実装は410 Goneの薄いハンドラに置換し、ルータ本体（articles等）はコードとして残置する
// （expand&contract戦略。物理削除は BL-01 で実施条件成立後に行う）。
const gone = (_req: Request, res: Response) => {
  res.status(410).json({ error: "このエンドポイントはv3ピボットにより凍結されました" });
};

// M-05修正: JWT_SECRETが未設定・既知のプレースホルダ・短すぎる場合はfail-fastする
// （テスト・開発を壊さないよう、.env.test/docker-compose.ymlの値をこの検証に通る値へ更新済み）。
assertJwtSecretConfigured(process.env.JWT_SECRET);

const app = express();
// B3-01修正（2026-07-28, REVIEW-backend-3.md）: trust proxy未設定だとRenderのedge/内部プロキシ経由で
// req.ipが常に内部プロキシ側のIPになり、IP単位のレート制限が全ユーザー1バケットに潰れる
// （ADR-010と同じ「実クライアントIPの信頼モデル」の論点）。Renderは単一のリバースプロキシを
// 経由するので、ホップ数1を信頼する設定にし、X-Forwarded-Forの先頭値を実クライアントIPとして使う。
app.set("trust proxy", 1);
// m-06修正（2026-07-27, REVIEW-backend-2.md）: X-Powered-By: Express は未認証で誰でも取得できる
// 指紋情報。実害は小さいが1行で消せるため即実施。
app.disable("x-powered-by");
const PORT = process.env.PORT ?? 8000;

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3001,http://localhost:3000")
  .split(",")
  .map((o) => o.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
// v3(T-12, ARCH.md §4): /api/sessions系はgridJson/rawGpxを含むためlimitを拡張。
// 既存ルートのlimitは変えない（express.jsonは既にreq._bodyがtrueなら再パースをスキップするため安全に併存できる）。
//
// Issue #40 でセッション作成と全艇のトラック投入を1リクエストに統合した（部分永続化を防ぐため）。
// これにより従来「艇ごとに8MBまで」だったものが「全艇合計で8MBまで」に変わるので上限を引き上げる。
// Team Lead 実測（2026-08-04・spike/gpx の2時間1Hzデータ）:
//   1艇あたり rawGpx 661KB + gridJson 146KB = POST body 843KB
// ただしフィクスチャは lat/lon/time のみの合成データで、実機（Geo Tracker等）の
// ele や extensions を含むGPXはこれより嵩む。上限の4時間（MAX_DURATION_SEC=14400）と
// 実機の冗長さを見込むと 1艇あたり約3MB、6艇で約17MB になりうる。
// 24MB あれば上限4時間×6艇でも収まる見積り。
//
// より筋の良い解は「rawGpx をこのリクエストに載せず、トラック単位で後から送る」だが、
// Track.rawGpx が NOT NULL のためスキーマ変更（expand-first のマイグレーション）が要る。
// 現時点では上限引き上げで足り、必要になったら別Issueで扱う。
//
// レビュー指摘（2026-08-04）: express.json は認証より前に動くため、上限を24MBに上げると
// 未認証の第三者でも24MBの本文をパースさせられる（登録が誰でも通る以上、メモリ負荷の入口）。
// 本文を読む前に署名だけを検証する軽量ゲートを挟む。DBは引かない（実際の認可は後段の
// authMiddleware が担う）。/api/sessions・/api/tracks はどのみち全ルートが認証必須なので、
// ここで落としても正当なリクエストの挙動は変わらない。
app.use("/api/sessions", requireBearerSignature, express.json({ limit: "24mb" }));
app.use("/api/tracks", requireBearerSignature, express.json({ limit: "8mb" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/boat-types", boatTypesRouter);
app.use("/api/sailors", sailorsRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/tracks", tracksRouter);
app.use("/api/annotations", annotationsRouter);
// T-31: 認証不要の公開取得API（ADR-007）。JWT必須の他ルートとは別の未認証入口。
app.use("/api/public", publicRouter);

// 凍結ルート（410 Gone。ADR-003）
app.all("/api/articles", gone);
app.all("/api/articles/*", gone);
app.all("/api/users/:username/follow", gone);
app.all("/api/users/:username/follow/*", gone);
app.all("/api/tags", gone);
app.all("/api/tags/*", gone);
app.all("/api/bookmarks", gone);
app.all("/api/bookmarks/*", gone);
app.all("/api/questions", gone);
app.all("/api/questions/*", gone);
app.all("/api/posts", gone);
app.all("/api/posts/*", gone);
app.all("/api/courses", gone);
app.all("/api/courses/*", gone);

// Quality Gate Major2修正（依存ゼロ・Team Lead裁定2026-07-26）: DB例外等でプロセスが落ちるのを防ぐ
// グローバルエラーハンドラ。各ルートは lib/asyncHandler.ts の wrap() で async ハンドラを包んでおり、
// reject した Promise は wrap() 内の .catch(next) 経由でここへ届く（同期的なthrowも同様に届く）。
// 確実に500応答へ落とす（プロセスは継続する）。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;

  // レビュー指摘（2026-08-04・PR #53）: body-parser が上限超過で投げる例外は
  // type === "entity.too.large" を持つが、ここで一律500に変換していたため
  // 「大きすぎる」という原因がクライアントに伝わらなかった（サーバ障害と区別できない）。
  // 不正な JSON（entity.parse.failed）も同様にクライアント起因なので400で返す。
  const type = (err as { type?: string })?.type;
  if (type === "entity.too.large") {
    console.warn("Payload too large:", (err as { length?: number })?.length);
    res.status(413).json({ error: "取込データが大きすぎます。艇を分けて取り込んでください" });
    return;
  }
  if (type === "entity.parse.failed") {
    res.status(400).json({ error: "リクエストの形式が不正です" });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// 保険（多重防御）: wrap()の適用漏れや、Express層の外（タイマー等）で起きた未処理rejection/例外で
// プロセスが落ちるのを防ぐ。個別リクエストへの500応答は保証できない（レスポンスに紐づく情報がないため）が、
// 「1回の例外でサーバ全体が落ちてcold startになる」という最悪ケースは防ぐ。
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (process kept alive):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (process kept alive):", err);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 sailvlog backend running on http://localhost:${PORT}`);
  });
}

export default app;
