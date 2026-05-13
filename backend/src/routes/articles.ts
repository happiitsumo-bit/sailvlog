import { Router, Request, Response } from "express";
import slugify from "slugify";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

const articleSelect = {
  id: true,
  title: true,
  slug: true,
  contentMd: true,
  isPublished: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, username: true, avatarUrl: true } },
  boatType: { select: { id: true, name: true, slug: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  _count: { select: { likes: true, comments: true, bookmarks: true } },
};

// GET /api/articles — 公開記事一覧
router.get("/", async (req: Request, res: Response) => {
  const { boatType, tag, author, page = "1", limit = "20" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: Record<string, unknown> = { isPublished: true };
  if (boatType) where.boatType = { slug: boatType };
  if (tag) where.tags = { some: { tag: { slug: tag } } };
  if (author) where.author = { username: author };

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: articleSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.article.count({ where }),
  ]);

  res.json({ articles, total, page: Number(page), limit: Number(limit) });
});

// GET /api/articles/:slug — 記事詳細
router.get("/:slug", async (req: Request, res: Response): Promise<void> => {
  const article = await prisma.article.findUnique({
    where: { slug: req.params.slug },
    select: articleSelect,
  });

  if (!article || !article.isPublished) {
    res.status(404).json({ error: "記事が見つかりません" });
    return;
  }

  // 閲覧数を +1（レスポンスを待たない）
  prisma.article.update({
    where: { slug: req.params.slug },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {});

  res.json(article);
});

// POST /api/articles — 記事作成（要認証）
router.post("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, contentMd, boatTypeId, tagIds = [], isPublished = false } = req.body;

  if (!title || !contentMd || !boatTypeId) {
    res.status(400).json({ error: "title, contentMd, boatTypeId は必須です" });
    return;
  }

  // slug 生成（重複時は末尾に数字を付ける）
  let baseSlug = slugify(title, { lower: true, strict: true, locale: "ja" });
  if (!baseSlug) baseSlug = `article-${Date.now()}`;

  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.article.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const article = await prisma.article.create({
    data: {
      title,
      contentMd,
      slug,
      isPublished,
      authorId: req.userId!,
      boatTypeId: Number(boatTypeId),
      tags: {
        create: (tagIds as number[]).map((tagId) => ({ tagId: Number(tagId) })),
      },
    },
    select: articleSelect,
  });

  res.status(201).json(article);
});

// PUT /api/articles/:slug — 記事更新（本人のみ）
router.put("/:slug", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const article = await prisma.article.findUnique({ where: { slug: req.params.slug } });

  if (!article) {
    res.status(404).json({ error: "記事が見つかりません" });
    return;
  }
  if (article.authorId !== req.userId) {
    res.status(403).json({ error: "この操作は許可されていません" });
    return;
  }

  const { title, contentMd, boatTypeId, tagIds, isPublished } = req.body;

  if (tagIds !== undefined) {
    await prisma.articleTag.deleteMany({ where: { articleId: article.id } });
  }

  const updated = await prisma.article.update({
    where: { slug: req.params.slug },
    data: {
      ...(title !== undefined && { title }),
      ...(contentMd !== undefined && { contentMd }),
      ...(boatTypeId !== undefined && { boatTypeId: Number(boatTypeId) }),
      ...(isPublished !== undefined && { isPublished }),
      ...(tagIds !== undefined && {
        tags: { create: (tagIds as number[]).map((tagId) => ({ tagId: Number(tagId) })) },
      }),
    },
    select: articleSelect,
  });

  res.json(updated);
});

// DELETE /api/articles/:slug — 記事削除（本人のみ）
router.delete("/:slug", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const article = await prisma.article.findUnique({ where: { slug: req.params.slug } });

  if (!article) {
    res.status(404).json({ error: "記事が見つかりません" });
    return;
  }
  if (article.authorId !== req.userId) {
    res.status(403).json({ error: "この操作は許可されていません" });
    return;
  }

  await prisma.article.delete({ where: { slug: req.params.slug } });
  res.status(204).send();
});

export default router;
