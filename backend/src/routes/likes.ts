import { Router, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router({ mergeParams: true });

// POST /api/articles/:slug/like — いいね
router.post("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const article = await prisma.article.findUnique({ where: { slug: req.params.slug } });
  if (!article) {
    res.status(404).json({ error: "記事が見つかりません" });
    return;
  }

  try {
    await prisma.like.create({ data: { userId: req.userId!, articleId: article.id } });
    const count = await prisma.like.count({ where: { articleId: article.id } });
    res.status(201).json({ liked: true, count });
  } catch {
    res.status(409).json({ error: "既にいいねしています" });
  }
});

// DELETE /api/articles/:slug/like — いいね取り消し
router.delete("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const article = await prisma.article.findUnique({ where: { slug: req.params.slug } });
  if (!article) {
    res.status(404).json({ error: "記事が見つかりません" });
    return;
  }

  await prisma.like.deleteMany({
    where: { userId: req.userId!, articleId: article.id },
  });

  const count = await prisma.like.count({ where: { articleId: article.id } });
  res.json({ liked: false, count });
});

export default router;
