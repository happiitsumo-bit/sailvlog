import { Router, Request, Response } from "express";
import prisma from "../database";
import { wrap } from "../lib/asyncHandler";

const router = Router();

// GET /api/boat-types
// M-07修正（2026-07-27, REVIEW-backend-2.md）: このハンドラだけwrap()漏れがあり、DB例外時に
// レスポンスが返らずクライアントがタイムアウトまでハングしていた（index.ts:67-68のコメント
// 「各ルートはwrap()で包んでおり」という前提が実態と食い違っていた）。他ルートと揃える。
router.get("/", wrap(async (_req: Request, res: Response) => {
  const boatTypes = await prisma.boatType.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, slug: true, description: true },
  });
  res.json(boatTypes);
}));

export default router;
