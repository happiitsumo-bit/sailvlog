import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /api/teams — 一覧
// Quality Gate Blocker修正: 未認証で全チームslug + 部員名簿(氏名/専門/経験年数/艇種)が取得できていた
// （/api/teams → slug特定 → /api/teams/:slug で名簿取得、という経路。共有1でチーム名が公開ページに
// 出るようになったことで初めて成立した）。authMiddlewareを追加し、部内ログイン済みユーザーのみに限定する。
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { category, search } = req.query;

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: "insensitive" } },
        { university: { contains: String(search), mode: "insensitive" } },
        { region: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const teams = await prisma.team.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { members: true, articles: true, questions: true },
        },
      },
    });

    res.json({ teams, total: teams.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/teams/:slug — 詳細（部員名簿を含むためBlocker修正で認証必須化）
router.get("/:slug", authMiddleware, async (req, res) => {
  try {
    const team = await prisma.team.findUnique({
      where: { slug: req.params.slug },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                specialty: true,
                experienceYears: true,
                boatType: { select: { name: true, slug: true } },
              },
            },
          },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        },
        _count: {
          select: { articles: true, questions: true },
        },
      },
    });

    if (!team) return res.status(404).json({ error: "Team not found" });
    res.json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/teams/:slug/articles — チームの記事一覧
router.get("/:slug/articles", async (req, res) => {
  try {
    const team = await prisma.team.findUnique({ where: { slug: req.params.slug } });
    if (!team) return res.status(404).json({ error: "Team not found" });

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where: { teamId: team.id, isPublished: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          boatType: { select: { id: true, name: true, slug: true } },
          tags: { include: { tag: true } },
          _count: { select: { likes: true, comments: true, bookmarks: true } },
        },
      }),
      prisma.article.count({ where: { teamId: team.id, isPublished: true } }),
    ]);

    res.json({ articles, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/teams/:slug/questions — チームのQ&A一覧
router.get("/:slug/questions", async (req, res) => {
  try {
    const team = await prisma.team.findUnique({ where: { slug: req.params.slug } });
    if (!team) return res.status(404).json({ error: "Team not found" });

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where: { teamId: team.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          author: { select: { id: true, username: true } },
          boatType: { select: { id: true, name: true, slug: true } },
          tags: { include: { tag: true } },
          answers: { select: { id: true, isAccepted: true } },
          _count: { select: { answers: true, votes: true } },
        },
      }),
      prisma.question.count({ where: { teamId: team.id } }),
    ]);

    res.json({ questions, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
