import { Router, Request, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/users/:username — プロフィール
router.get("/:username", async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: {
      id: true,
      username: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      _count: { select: { articles: true, followers: true, following: true } },
      articles: {
        where: { isPublished: true },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, title: true, slug: true, createdAt: true,
          boatType: { select: { name: true, slug: true } },
          _count: { select: { likes: true } },
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: "ユーザーが見つかりません" });
    return;
  }

  res.json(user);
});

// PUT /api/users/me — 自分のプロフィール更新
router.put("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { bio, avatarUrl } = req.body;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...(bio !== undefined && { bio }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    },
    select: { id: true, username: true, bio: true, avatarUrl: true },
  });

  res.json(user);
});

export default router;
