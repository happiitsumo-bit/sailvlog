import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";

import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import boatTypesRouter from "./routes/boatTypes";
import sailorsRouter from "./routes/sailors";
import teamsRouter from "./routes/teams";
import sessionsRouter from "./routes/sessions";
import tracksRouter from "./routes/tracks";
import annotationsRouter from "./routes/annotations";

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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 sailvlog backend running on http://localhost:${PORT}`);
  });
}

export default app;
