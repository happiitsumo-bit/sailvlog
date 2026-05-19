import { Router, Request, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

const questionSelect = {
  id: true,
  title: true,
  body: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, username: true, bio: true, avatarUrl: true, specialty: true, experienceYears: true } },
  boatType: { select: { id: true, name: true, slug: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  _count: { select: { answers: true, votes: true } },
  answers: {
    select: { id: true, isAccepted: true },
    where: { isAccepted: true },
    take: 1,
  },
};

// GET /api/questions — 質問一覧
router.get("/", async (req: Request, res: Response) => {
  try {
    const { boatType, tag, filter, page = "1", limit = "20" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (boatType) where.boatType = { slug: boatType };
    if (tag) where.tags = { some: { tag: { slug: tag } } };
    if (filter === "unanswered") where.answers = { none: {} };
    if (filter === "solved") where.answers = { some: { isAccepted: true } };

    const orderBy =
      filter === "top"
        ? { votes: { _count: "desc" as const } }
        : { createdAt: "desc" as const };

    const [questions, total] = await Promise.all([
      prisma.question.findMany({ where, select: questionSelect, orderBy, skip, take: Number(limit) }),
      prisma.question.count({ where }),
    ]);

    res.json({ questions, total, page: Number(page) });
  } catch {
    res.status(500).json({ error: "質問一覧の取得に失敗しました" });
  }
});

// GET /api/questions/:id — 質問詳細
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

    const question = await prisma.question.findUnique({
      where: { id },
      select: {
        ...questionSelect,
        answers: {
          select: {
            id: true,
            body: true,
            isAccepted: true,
            createdAt: true,
            author: { select: { id: true, username: true, bio: true, avatarUrl: true, specialty: true, experienceYears: true } },
            _count: { select: { votes: true } },
          },
          orderBy: [{ isAccepted: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!question) { res.status(404).json({ error: "質問が見つかりません" }); return; }

    // viewCount は fire-and-forget（失敗してもレスポンスに影響させない）
    prisma.question.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

    res.json(question);
  } catch {
    res.status(500).json({ error: "質問の取得に失敗しました" });
  }
});

// POST /api/questions — 質問投稿
router.post("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, body, boatTypeId, tagIds } = req.body;
    if (!title || !body) { res.status(400).json({ error: "title と body は必須です" }); return; }
    if (title.length > 255) { res.status(400).json({ error: "タイトルは255文字以内にしてください" }); return; }

    const question = await prisma.question.create({
      data: {
        title,
        body,
        authorId: req.userId!,
        boatTypeId: boatTypeId ?? null,
        tags: tagIds?.length
          ? { create: tagIds.map((tagId: number) => ({ tagId })) }
          : undefined,
      },
      select: questionSelect,
    });

    res.status(201).json(question);
  } catch {
    res.status(500).json({ error: "質問の投稿に失敗しました" });
  }
});

// POST /api/questions/:id/answers — 回答投稿
router.post("/:id/answers", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const questionId = Number(req.params.id);
    if (isNaN(questionId)) { res.status(400).json({ error: "invalid id" }); return; }
    const { body } = req.body;
    if (!body) { res.status(400).json({ error: "body は必須です" }); return; }

    const answer = await prisma.answer.create({
      data: { body, authorId: req.userId!, questionId },
      select: {
        id: true, body: true, isAccepted: true, createdAt: true,
        author: { select: { id: true, username: true, avatarUrl: true, specialty: true } },
        _count: { select: { votes: true } },
      },
    });

    res.status(201).json(answer);
  } catch {
    res.status(500).json({ error: "回答の投稿に失敗しました" });
  }
});

// PUT /api/questions/:id/answers/:answerId/accept — ベストアンサー
router.put("/:id/answers/:answerId/accept", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const questionId = Number(req.params.id);
    const answerId = Number(req.params.answerId);

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) { res.status(404).json({ error: "質問が見つかりません" }); return; }
    if (question.authorId !== req.userId) { res.status(403).json({ error: "質問の投稿者のみ操作できます" }); return; }

    await prisma.answer.updateMany({ where: { questionId, isAccepted: true }, data: { isAccepted: false } });
    const answer = await prisma.answer.update({ where: { id: answerId }, data: { isAccepted: true } });

    res.json(answer);
  } catch {
    res.status(500).json({ error: "ベストアンサーの設定に失敗しました" });
  }
});

// POST /api/questions/:id/vote — 質問への投票
router.post("/:id/vote", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const questionId = Number(req.params.id);
    const { value } = req.body;

    if (value !== 1 && value !== -1) { res.status(400).json({ error: "value は 1 または -1 です" }); return; }

    const existing = await prisma.questionVote.findUnique({
      where: { userId_questionId: { userId: req.userId!, questionId } },
    });

    if (existing) {
      if (existing.value === value) {
        await prisma.questionVote.delete({ where: { id: existing.id } });
      } else {
        await prisma.questionVote.update({ where: { id: existing.id }, data: { value } });
      }
    } else {
      await prisma.questionVote.create({ data: { userId: req.userId!, questionId, value } });
    }

    const voteSum = await prisma.questionVote.aggregate({ where: { questionId }, _sum: { value: true } });
    res.json({ voteCount: voteSum._sum.value ?? 0 });
  } catch {
    res.status(500).json({ error: "投票に失敗しました" });
  }
});

// POST /api/questions/:id/answers/:answerId/vote — 回答への投票
router.post("/:id/answers/:answerId/vote", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const answerId = Number(req.params.answerId);
    const { value } = req.body;

    if (value !== 1 && value !== -1) { res.status(400).json({ error: "value は 1 または -1 です" }); return; }

    const existing = await prisma.answerVote.findUnique({
      where: { userId_answerId: { userId: req.userId!, answerId } },
    });

    if (existing) {
      if (existing.value === value) {
        await prisma.answerVote.delete({ where: { id: existing.id } });
      } else {
        await prisma.answerVote.update({ where: { id: existing.id }, data: { value } });
      }
    } else {
      await prisma.answerVote.create({ data: { userId: req.userId!, answerId, value } });
    }

    const voteSum = await prisma.answerVote.aggregate({ where: { answerId }, _sum: { value: true } });
    res.json({ voteCount: voteSum._sum.value ?? 0 });
  } catch {
    res.status(500).json({ error: "投票に失敗しました" });
  }
});

export default router;
