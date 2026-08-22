import crypto from "crypto";
import { Router, Request, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";
import { Prisma } from "@prisma/client";

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

// DELETE /api/users/me — 自分自身のアカウント削除（Issue #22）。
// 対象は常に req.userId（JWTの本人）のみで、他人を指定する経路はそもそも存在しない
// （「本人しか削除できない」をURL設計自体で担保する。管理者による他人削除は実装しない）。
//
// 物理削除ではなく無効化＋匿名化にした。理由:
// - schema.prisma で User の子リレーション（Session.uploader / Annotation.author /
//   TeamMember.user / Article.author 等）はいずれも onDelete が既定（Restrict相当）で、
//   prisma.user.delete() は該当データが1件でもあれば外部キー制約違反（P2003）で失敗する。
// - 仮にcascade delete化すると、そのユーザーがuploadしたSession/Trackや投稿した
//   Annotationまで消え、チームの練習記録が本人都合で意図せず消滅する
//   （Issue本文の懸念「チームの記録が意図せず消えないか」に直接抵触する）。
// よって、Userの行自体は残したまま個人情報だけ匿名化し、isActive=falseでログインを
// 塞ぐ（auth.tsのlogin判定が既に isActive を見ている）。Session.uploaderId等のFKは
// 有効なまま残るため、チームの履歴は失われない。
//
// ADR-013決定6と同型の不変条件: このユーザーが唯一のadminであるチームが1つでもあれば、
// 削除（＝そのチームからの離脱を含む）はチームを管理不能にするため409で拒否する
// （teams.ts の PATCH/DELETE members と同じ考え方。teams.tsは編集不可のためここに実装）。
router.delete("/me", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId as number;

  // レビュー指摘の修正: 判定と削除が別トランザクションだと、2人のadminが同時に自分を削除したとき
  // 両方が「adminは2人いる」を見て通過し、admin 0人のチームが残る（teams.ts の C-06 と同型）。
  // 判定から書き込みまでを1つの Serializable トランザクションに入れる。
  const blockingTeamSlugs = await prisma.$transaction(async (tx) => {
    const adminMemberships = await tx.teamMember.findMany({
      where: { userId, role: "admin" },
      select: { teamId: true, team: { select: { slug: true } } },
    });

    const blocking: string[] = [];
    for (const membership of adminMemberships) {
      const adminCount = await tx.teamMember.count({
        where: { teamId: membership.teamId, role: "admin" },
      });
      if (adminCount <= 1) blocking.push(membership.team.slug);
    }
    if (blocking.length > 0) return blocking;

    await tx.teamMember.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        username: `deleted-user-${userId}`,
        email: `deleted-user-${userId}@deleted.invalid`,
        // ログイン自体はisActive判定で既に塞がれるが、平文/旧ハッシュを残さないため無効な値で上書きする。
        hashedPassword: crypto.randomBytes(32).toString("hex"),
        bio: null,
        avatarUrl: null,
        specialty: null,
        affiliation: null,
        experienceYears: null,
        boatTypeId: null,
      },
    });
    return [];
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (blockingTeamSlugs.length > 0) {
    res.status(409).json({
      error: "唯一の管理者になっているチームがあります。先に他のメンバーをadminにしてから削除してください",
      teams: blockingTeamSlugs,
    });
    return;
  }

  res.status(204).send();
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
