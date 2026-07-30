import { Router, Request, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";

const router = Router();

// GET /api/users/me — 自分のプロフィール取得（/:username より先に登録する必要がある）
// Quality Gate Major2修正: wrap()でasyncハンドラの例外をグローバルエラーハンドラへ確実に渡す
router.get("/me", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
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
}));

// PUT /api/users/me — 自分のプロフィール更新（/:username より先に登録する必要がある。M3-01修正）
// Quality Gate Major2修正: wrap()でasyncハンドラの例外をグローバルエラーハンドラへ確実に渡す
router.put("/me", authMiddleware, wrap(async (req: AuthRequest, res: Response) => {
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
}));

// GET・PUT・その他 /api/users/:username — プロフィール
// B-02修正（2026-07-27, REVIEW-backend-2.md・案B）: authMiddlewareだけでは「ログイン済みの
// 部外者」を弾けない（registerが誰でも通るため）。無関係な第三者にspecialty/affiliation/
// experienceYearsを見せない「関係」を定義できないv1機能なので、sailors.ts（同種の指摘）と
// 揃えてADR-003方式（410 Gone）で凍結する。v3 frontendからの利用はゼロ（grep済み・ヒット0）。
// 自分自身のプロフィール取得/更新（GET・PUT /api/users/me）は本人限定で第三者への漏洩が
// 無いため凍結対象外（残す）。
// M3-01修正（2026-07-28, REVIEW-backend-3.md）: この router.all("/:username") が
// router.put("/me") より前に登録されていたため、"me" がusernameとしてマッチし
// PUT /api/users/me が410に飲まれていた（コメントの宣言と実装が矛盾）。
// GET /me・PUT /me を両方この router.all より前に登録することで解消する。
router.all("/:username", (_req: Request, res: Response) => {
  res.status(410).json({ error: "このエンドポイントはv3ピボットにより凍結されました" });
});

export default router;
