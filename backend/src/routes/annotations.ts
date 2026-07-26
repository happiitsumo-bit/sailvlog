import { Router, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { isAuthorOrTeamAdmin } from "../middleware/requireTeamMember";
import { validateAnnotationPayload } from "../lib/validateAnnotationPayload";
import { wrap } from "../lib/asyncHandler";

const router = Router();

// PATCH /api/annotations/:id — body更新（ARCH.md §4。author本人 or Team admin のみ）
// Quality Gate Major2修正: wrap()でasyncハンドラの例外をグローバルエラーハンドラへ確実に渡す
router.patch("/:id", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "不正な注釈IDです" });
    return;
  }

  const annotation = await prisma.annotation.findUnique({ where: { id }, include: { session: true } });
  if (!annotation) {
    res.status(404).json({ error: "注釈が見つかりません" });
    return;
  }

  const allowed = await isAuthorOrTeamAdmin(req.userId as number, annotation.session.teamId, annotation.authorId);
  if (!allowed) {
    res.status(403).json({ error: "更新できるのは投稿者本人またはチーム管理者のみです" });
    return;
  }

  const { body } = req.body;
  const result = validateAnnotationPayload(
    { tSec: annotation.tSec, body, trackId: annotation.trackId, legIndex: annotation.legIndex },
    annotation.session.durationSec
  );
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const updated = await prisma.annotation.update({ where: { id }, data: { body } });
  res.json({ annotation: updated });
}));

// DELETE /api/annotations/:id — 削除（ARCH.md §4。author本人 or Team admin のみ）
router.delete("/:id", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "不正な注釈IDです" });
    return;
  }

  const annotation = await prisma.annotation.findUnique({ where: { id }, include: { session: true } });
  if (!annotation) {
    res.status(404).json({ error: "注釈が見つかりません" });
    return;
  }

  const allowed = await isAuthorOrTeamAdmin(req.userId as number, annotation.session.teamId, annotation.authorId);
  if (!allowed) {
    res.status(403).json({ error: "削除できるのは投稿者本人またはチーム管理者のみです" });
    return;
  }

  await prisma.annotation.delete({ where: { id } });
  res.status(204).send();
}));

export default router;
