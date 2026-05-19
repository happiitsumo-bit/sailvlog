import { Router, Request, Response } from "express";
import prisma from "../database";

const router = Router();

const sailorSelect = {
  id: true,
  username: true,
  bio: true,
  avatarUrl: true,
  specialty: true,
  affiliation: true,
  experienceYears: true,
  createdAt: true,
  boatType: { select: { id: true, name: true, slug: true } },
  _count: { select: { articles: true, questions: true, followers: true } },
};

// GET /api/sailors — セーラー一覧 + 検索
router.get("/", async (req: Request, res: Response) => {
  const { q, boatType, page = "1", limit = "24" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: Record<string, unknown> = { isActive: true };
  if (boatType) where.boatType = { slug: boatType };
  if (q) {
    const term = q as string;
    where.OR = [
      { username: { contains: term, mode: "insensitive" } },
      { specialty: { contains: term, mode: "insensitive" } },
      { affiliation: { contains: term, mode: "insensitive" } },
    ];
  }

  const [sailors, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: sailorSelect,
      orderBy: { followers: { _count: "desc" } },
      skip,
      take: Number(limit),
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ sailors, total, page: Number(page) });
});

// GET /api/sailors/:username — セーラー詳細 (users/:usernameと別に用意)
router.get("/:username", async (req: Request, res: Response): Promise<void> => {
  const sailor = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: sailorSelect,
  });

  if (!sailor) { res.status(404).json({ error: "セーラーが見つかりません" }); return; }

  res.json(sailor);
});

export default router;
