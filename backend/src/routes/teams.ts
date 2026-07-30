import { Router, Request, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";

const router = Router();

// B-02修正（2026-07-27, REVIEW-backend-2.md）: 以前は authMiddleware（=ログイン済みか）だけで
// 部員名簿を守っていたが、POST /api/auth/register が招待制でも承認制でもないため「ログイン済みか」は
// 「部外者かどうか」を全く弁別しない（登録1回で誰でもログイン済みになれる）。
// この機密境界は「認証済みか」ではなく「そのチームのメンバーという関係にあるか」なので、
// GET /api/teams は自分が所属するチームのみ、GET /api/teams/:slug は非メンバーには404（存在の有無を含め教えない）
// にする。判断理由は実装報告に記載（Team Lead申し送り）。

// GET /api/teams — 一覧（自分が所属するチームのみ）
router.get("/", authMiddleware, wrap(async (req: AuthRequest, res: Response) => {
  const { category, search } = req.query;

  const where: Record<string, unknown> = {
    members: { some: { userId: req.userId as number } },
  };
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
}));

// GET /api/teams/:slug — 詳細（部員名簿を含む。自分がメンバーであるチームのみ。非メンバーは404）
router.get("/:slug", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
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

  // チームが存在しない場合と、存在するが自分がメンバーでない場合を同じ404で返す
  // （「存在するが権限が無い」を教えるとteam slugの存在オラクルになるため。middleware/auth.tsの
  // authMiddlewareOr404と同じ考え方）。
  const isMember = team?.members.some((m) => m.user.id === req.userId) ?? false;
  if (!team || !isMember) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  res.json(team);
}));

const gone = (_req: Request, res: Response) => {
  res.status(410).json({ error: "このエンドポイントはv3ピボットにより凍結されました" });
};

// M-01修正（2026-07-27, REVIEW-backend-2.md）: /:slug/articles・/:slug/questions は
// 未認証のまま記事本文全文・投稿者名を返していた（R-01/B-02修正の取りこぼし）。
// ADR-003で /api/articles・/api/questions 本体は410凍結済みなので、同じデータへの別ドアである
// この2本も同じ方針（410 Gone）に揃える。frontendからの利用はゼロ（grep済み・ヒット0）。
router.all("/:slug/articles", gone);
router.all("/:slug/articles/*", gone);
router.all("/:slug/questions", gone);
router.all("/:slug/questions/*", gone);

export default router;
