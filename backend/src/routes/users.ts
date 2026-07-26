import { Router, Request, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/users/me — 自分のプロフィール取得（/:username より先に登録する必要がある）
router.get("/me", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true, username: true, email: true, bio: true, avatarUrl: true,
      specialty: true, affiliation: true, experienceYears: true,
      boatType: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!user) { res.status(404).json({ error: "ユーザーが見つかりません" }); return; }
  res.json(user);
});

// GET /api/users/:username — プロフィール
// Quality Gate Blocker修正と同種の指摘: 未認証でspecialty/affiliation/experienceYears等が
// 取得できていたため authMiddleware を追加（teams.ts:40-70 の指摘と同種）。
router.get("/:username", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: {
      id: true,
      username: true,
      bio: true,
      avatarUrl: true,
      specialty: true,
      affiliation: true,
      experienceYears: true,
      createdAt: true,
      boatType: { select: { id: true, name: true, slug: true } },
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
  const { bio, avatarUrl, specialty, affiliation, experienceYears, boatTypeId } = req.body;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...(bio !== undefined && { bio }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(specialty !== undefined && { specialty }),
      ...(affiliation !== undefined && { affiliation }),
      ...(experienceYears !== undefined && { experienceYears: experienceYears === null ? null : Number(experienceYears) }),
      ...(boatTypeId !== undefined && { boatTypeId: boatTypeId ? Number(boatTypeId) : null }),
    },
    select: {
      id: true, username: true, bio: true, avatarUrl: true,
      specialty: true, affiliation: true, experienceYears: true,
      boatType: { select: { id: true, name: true, slug: true } },
    },
  });

  res.json(user);
});

export default router;
