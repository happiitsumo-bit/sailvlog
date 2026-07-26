import "dotenv/config";
// Quality Gate Major修正: Express 4 + Node 20ではasyncハンドラ内の未処理rejectionが
// next(err)へ渡らずプロセスごと終了する。express-async-errorsをexpressより先にimportすることで
// Router.get/post等をパッチし、asyncハンドラの例外を自動的にnext(err)へ回すようにする
// （個別ルートのtry/catchを全部書き換える必要がない安全網。既存のtry/catch付きルートには影響しない）。
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

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

const app = express();
const PORT = process.env.PORT ?? 8000;

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3001,http://localhost:3000")
  .split(",")
  .map((o) => o.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
// v3(T-12, ARCH.md §4): /api/sessions系はgridJson/rawGpxを含むためlimitを拡張。
// 既存ルートのlimitは変えない（express.jsonは既にreq._bodyがtrueなら再パースをスキップするため安全に併存できる）。
app.use("/api/sessions", express.json({ limit: "8mb" }));
app.use("/api/tracks", express.json({ limit: "8mb" }));
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

// Quality Gate Major修正: DB例外等でプロセスが落ちるのを防ぐグローバルエラーハンドラ。
// express-async-errors経由でnext(err)に渡ってきた例外・同期的にthrowされた例外の両方をここで受け止め、
// 確実に500応答へ落とす（プロセスは継続する）。ルート個別のtry/catchはこれを置き換えるものではなく、
// 「catchし忘れた場合の安全網」として最後段に置く。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal Server Error" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 sailvlog backend running on http://localhost:${PORT}`);
  });
}

export default app;
