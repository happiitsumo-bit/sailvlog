import { Router, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router({ mergeParams: true });

// POST /api/articles/:slug/bookmark
router.post("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const article = await prisma.article.findUnique({ where: { slug: req.params.slug } });
    if (!article) { res.status(404).json({ error: "記事が見つかりません" }); return; }

    await prisma.bookmark.create({ data: { userId: req.userId!, articleId: article.id } });
    res.status(201).json({ bookmarked: true });
  } catch {
    res.status(409).json({ error: "既にブックマークしています" });
  }
});

// DELETE /api/articles/:slug/bookmark
router.delete("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const article = await prisma.article.findUnique({ where: { slug: req.params.slug } });
    if (!article) { res.status(404).json({ error: "記事が見つかりません" }); return; }

    await prisma.bookmark.deleteMany({
      where: { userId: req.userId!, articleId: article.id },
    });

    res.json({ bookmarked: false });
  } catch {
    res.status(500).json({ error: "ブックマークの削除に失敗しました" });
  }
});

// GET /api/bookmarks/me — 自分のブックマーク一覧
export const myBookmarksRouter = Router();
myBookmarksRouter.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      include: {
        article: {
          select: {
            id: true, title: true, slug: true, createdAt: true,
            author: { select: { username: true } },
            boatType: { select: { name: true, slug: true } },
            _count: { select: { likes: true } },
          },
        },
      },
    });
    res.json(bookmarks);
  } catch {
    res.status(500).json({ error: "ブックマークの取得に失敗しました" });
  }
});

export default router;
