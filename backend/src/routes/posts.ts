import { Router, Request, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

const postSelect = {
  id: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, username: true, avatarUrl: true, specialty: true, boatType: { select: { name: true, slug: true } } } },
  _count: { select: { likes: true } },
};

// GET /api/posts — タイムライン一覧
router.get("/", async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "30" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [posts, total] = await Promise.all([
      prisma.post.findMany({ select: postSelect, orderBy: { createdAt: "desc" }, skip, take: Number(limit) }),
      prisma.post.count(),
    ]);

    res.json({ posts, total, page: Number(page) });
  } catch {
    res.status(500).json({ error: "投稿の取得に失敗しました" });
  }
});

// POST /api/posts — 投稿
router.post("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { body } = req.body;
    if (!body || body.trim().length === 0) { res.status(400).json({ error: "本文は必須です" }); return; }
    if (body.length > 300) { res.status(400).json({ error: "300文字以内で投稿してください" }); return; }

    const post = await prisma.post.create({
      data: { body: body.trim(), authorId: req.userId! },
      select: postSelect,
    });

    res.status(201).json(post);
  } catch {
    res.status(500).json({ error: "投稿に失敗しました" });
  }
});

// DELETE /api/posts/:id — 削除
router.delete("/:id", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) { res.status(404).json({ error: "投稿が見つかりません" }); return; }
    if (post.authorId !== req.userId) { res.status(403).json({ error: "自分の投稿のみ削除できます" }); return; }

    await prisma.post.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "削除に失敗しました" });
  }
});

// POST /api/posts/:id/like — いいね
router.post("/:id/like", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = Number(req.params.id);

    const existing = await prisma.postLike.findUnique({
      where: { userId_postId: { userId: req.userId!, postId } },
    });

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
      const count = await prisma.postLike.count({ where: { postId } });
      res.json({ liked: false, likeCount: count });
    } else {
      await prisma.postLike.create({ data: { userId: req.userId!, postId } });
      const count = await prisma.postLike.count({ where: { postId } });
      res.json({ liked: true, likeCount: count });
    }
  } catch {
    res.status(500).json({ error: "いいねの処理に失敗しました" });
  }
});

export default router;
