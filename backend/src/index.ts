import "dotenv/config";
import express from "express";
import cors from "cors";

import authRouter from "./routes/auth";
import articlesRouter from "./routes/articles";
import usersRouter from "./routes/users";
import boatTypesRouter from "./routes/boatTypes";
import tagsRouter from "./routes/tags";
import likesRouter from "./routes/likes";
import bookmarksRouter, { myBookmarksRouter } from "./routes/bookmarks";
import followsRouter from "./routes/follows";
import commentsRouter from "./routes/comments";
import questionsRouter from "./routes/questions";
import postsRouter from "./routes/posts";
import coursesRouter from "./routes/courses";
import sailorsRouter from "./routes/sailors";

const app = express();
const PORT = process.env.PORT ?? 8000;

app.use(cors({ origin: ["http://localhost:3001", "http://localhost:3000"], credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/articles", articlesRouter);
app.use("/api/articles/:slug/like", likesRouter);
app.use("/api/articles/:slug/bookmark", bookmarksRouter);
app.use("/api/articles/:slug/comments", commentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/users/:username/follow", followsRouter);
app.use("/api/boat-types", boatTypesRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/bookmarks", myBookmarksRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/posts", postsRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/sailors", sailorsRouter);

app.listen(PORT, () => {
  console.log(`🚀 sailvlog backend running on http://localhost:${PORT}`);
});
