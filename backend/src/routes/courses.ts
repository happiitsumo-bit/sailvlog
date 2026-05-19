import { Router, Request, Response } from "express";
import prisma from "../database";

const router = Router();

const courseSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  description: true,
  level: true,
  estimatedHours: true,
  enrolledCount: true,
  accentColor: true,
  createdAt: true,
  boatType: { select: { id: true, name: true, slug: true } },
  courseArticles: {
    select: { id: true, position: true, title: true, minutes: true, articleId: true },
    orderBy: { position: "asc" as const },
  },
};

// GET /api/courses — コース一覧
router.get("/", async (req: Request, res: Response) => {
  const { level, boatType } = req.query;

  const where: Record<string, unknown> = {};
  if (level) where.level = (level as string).toUpperCase();
  if (boatType) where.boatType = { slug: boatType };

  const courses = await prisma.course.findMany({
    where,
    select: courseSelect,
    orderBy: { createdAt: "asc" },
  });

  res.json(courses);
});

// GET /api/courses/:slug — コース詳細
router.get("/:slug", async (req: Request, res: Response): Promise<void> => {
  const course = await prisma.course.findUnique({
    where: { slug: req.params.slug },
    select: courseSelect,
  });

  if (!course) { res.status(404).json({ error: "コースが見つかりません" }); return; }

  res.json(course);
});

export default router;
