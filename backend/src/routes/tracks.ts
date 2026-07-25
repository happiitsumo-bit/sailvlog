import { Router, Response } from "express";
import prisma from "../database";
import { authMiddlewareOr404, AuthRequest } from "../middleware/auth";
import { isTeamMember } from "../middleware/requireTeamMember";

const router = Router();

// GET /api/tracks/:id/gpx — 原本GPXのダウンロード（ARCH.md §4）
// T-31: 未認証は404（authMiddlewareOr404）。認証済みだが非TeamMemberは従来どおり403。
router.get("/:id/gpx", authMiddlewareOr404, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "不正なトラックIDです" });
    return;
  }

  const track = await prisma.track.findUnique({
    where: { id },
    include: { session: { select: { teamId: true } } },
  });
  if (!track) {
    res.status(404).json({ error: "トラックが見つかりません" });
    return;
  }

  const ok = await isTeamMember(req.userId as number, track.session.teamId);
  if (!ok) {
    res.status(403).json({ error: "このチームのメンバーではありません" });
    return;
  }

  res.setHeader("Content-Type", "application/gpx+xml");
  res.setHeader("Content-Disposition", `attachment; filename="track-${id}.gpx"`);
  res.send(track.rawGpx);
});

export default router;
