import { Router, Request, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router({ mergeParams: true });

// GET /api/articles/:slug/comments
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const article = await prisma.article.findUnique({ where: { slug: req.params.slug } });
  if (!article) {
    res.status(404).json({ error: "記事が見つかりません" });
    return;
  }

  const comments = await prisma.comment.findMany({
    where: { articleId: article.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { username: true, avatarUrl: true } },
    },
  });

  res.json(comments);
});

// POST /api/articles/:slug/comments
router.post("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { content } = req.body;
  if (!content) {
    res.status(400).json({ error: "content は必須です" });
    return;
  }

  const article = await prisma.article.findUnique({ where: { slug: req.params.slug } });
  if (!article) {
    res.status(404).json({ error: "記事が見つかりません" });
    return;
  }

  const comment = await prisma.comment.create({
    data: { content, authorId: req.userId!, articleId: article.id },
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { username: true, avatarUrl: true } },
    },
  });

  res.status(201).json(comment);
});

export default router;
