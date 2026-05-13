import { Router, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router({ mergeParams: true });

// POST /api/users/:username/follow
router.post("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const target = await prisma.user.findUnique({ where: { username: req.params.username } });
  if (!target) {
    res.status(404).json({ error: "ユーザーが見つかりません" });
    return;
  }
  if (target.id === req.userId) {
    res.status(400).json({ error: "自分自身はフォローできません" });
    return;
  }

  try {
    await prisma.follow.create({ data: { followerId: req.userId!, followingId: target.id } });
    res.status(201).json({ following: true });
  } catch {
    res.status(409).json({ error: "既にフォローしています" });
  }
});

// DELETE /api/users/:username/follow
router.delete("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const target = await prisma.user.findUnique({ where: { username: req.params.username } });
  if (!target) {
    res.status(404).json({ error: "ユーザーが見つかりません" });
    return;
  }

  await prisma.follow.deleteMany({
    where: { followerId: req.userId!, followingId: target.id },
  });

  res.json({ following: false });
});

export default router;
