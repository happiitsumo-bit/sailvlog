import { Router, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import {
  requireTeamMemberByBody,
  requireSessionTeamMember,
  isUploaderOrTeamAdmin,
  SessionScopedRequest,
} from "../middleware/requireTeamMember";
import { validateTrackPayload } from "../lib/validateTrackPayload";
import { validateAnnotationPayload } from "../lib/validateAnnotationPayload";

const router = Router();

const MAX_DURATION_SEC = 14400; // 4時間（ARCH.md §3）
const MAX_TITLE_LEN = 255;

// POST /api/sessions — 新規セッション作成
router.post(
  "/",
  authMiddleware,
  requireTeamMemberByBody(),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { title, type, startedAt, durationSec, teamId, venue, notes } = req.body;

    if (typeof title !== "string" || title.trim().length === 0 || title.length > MAX_TITLE_LEN) {
      res.status(400).json({ error: `title は必須です（1〜${MAX_TITLE_LEN}文字）` });
      return;
    }
    if (type !== undefined && type !== "practice" && type !== "race") {
      res.status(400).json({ error: "type は practice または race である必要があります" });
      return;
    }
    if (typeof startedAt !== "string" && typeof startedAt !== "number") {
      res.status(400).json({ error: "startedAt は必須です" });
      return;
    }
    const startedAtDate = new Date(startedAt);
    if (Number.isNaN(startedAtDate.getTime())) {
      res.status(400).json({ error: "startedAt が不正な日時です" });
      return;
    }
    if (!Number.isInteger(durationSec) || durationSec <= 0 || durationSec > MAX_DURATION_SEC) {
      res.status(400).json({ error: `durationSec は1〜${MAX_DURATION_SEC}の整数である必要があります` });
      return;
    }

    const session = await prisma.session.create({
      data: {
        title: title.trim(),
        type: type ?? "practice",
        startedAt: startedAtDate,
        durationSec,
        teamId: Number(teamId),
        uploaderId: req.userId as number,
        venue: venue ?? null,
        notes: notes ?? null,
      },
    });

    res.status(201).json({ session });
  }
);

// GET /api/sessions?teamId= — チームのセッション一覧（メタのみ）
router.get("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const teamId = Number(req.query.teamId);
  if (!Number.isInteger(teamId)) {
    res.status(400).json({ error: "teamId は必須です" });
    return;
  }

  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: req.userId as number, teamId } },
  });
  if (!member) {
    res.status(403).json({ error: "このチームのメンバーではありません" });
    return;
  }

  const sessions = await prisma.session.findMany({
    where: { teamId },
    orderBy: { startedAt: "desc" },
    include: { _count: { select: { tracks: true, annotations: true } } },
  });

  res.json({ sessions });
});

// GET /api/sessions/:id — 詳細（tracksはgridJson込み・rawGpx除外、annotations込み）
router.get(
  "/:id",
  authMiddleware,
  requireSessionTeamMember(),
  async (req: SessionScopedRequest, res: Response): Promise<void> => {
    const id = req.sessionRecord!.id;

    const [session, tracks, annotations] = await Promise.all([
      prisma.session.findUnique({ where: { id } }),
      prisma.track.findMany({
        where: { sessionId: id },
        select: {
          id: true,
          sessionId: true,
          boatLabel: true,
          startSec: true,
          pointCount: true,
          gridJson: true,
          sourceApp: true,
          createdAt: true,
          // rawGpxは除外（ARCH.md §4）
        },
      }),
      prisma.annotation.findMany({ where: { sessionId: id }, orderBy: { tSec: "asc" } }),
    ]);

    res.json({ session, tracks, annotations });
  }
);

// PATCH /api/sessions/:id — title/notes/marks/legsの更新（レグ境界の保存・補正）
router.patch(
  "/:id",
  authMiddleware,
  requireSessionTeamMember(),
  async (req: SessionScopedRequest, res: Response): Promise<void> => {
    const { title, notes, marks, legs } = req.body;
    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0 || title.length > MAX_TITLE_LEN) {
        res.status(400).json({ error: `title は1〜${MAX_TITLE_LEN}文字である必要があります` });
        return;
      }
      data.title = title.trim();
    }
    if (notes !== undefined) data.notes = notes;
    if (marks !== undefined) data.marks = marks;
    if (legs !== undefined) data.legs = legs;

    const session = await prisma.session.update({
      where: { id: req.sessionRecord!.id },
      data,
    });

    res.json({ session });
  }
);

// DELETE /api/sessions/:id — uploader本人 または Team admin のみ（Track/Annotationカスケード）
router.delete(
  "/:id",
  authMiddleware,
  requireSessionTeamMember(),
  async (req: SessionScopedRequest, res: Response): Promise<void> => {
    const allowed = await isUploaderOrTeamAdmin(req.userId as number, req.sessionRecord!);
    if (!allowed) {
      res.status(403).json({ error: "削除できるのはアップロード者本人またはチーム管理者のみです" });
      return;
    }
    await prisma.session.delete({ where: { id: req.sessionRecord!.id } });
    res.status(204).send();
  }
);

// POST /api/sessions/:id/tracks — 艇1つぶんのトラック投稿（構造検証込み。ARCH.md §4）
router.post(
  "/:id/tracks",
  authMiddleware,
  requireSessionTeamMember(),
  async (req: SessionScopedRequest, res: Response): Promise<void> => {
    const sessionId = req.sessionRecord!.id;
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      res.status(404).json({ error: "セッションが見つかりません" });
      return;
    }

    const result = validateTrackPayload(req.body, session.durationSec);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const { boatLabel, startSec, pointCount, gridJson, rawGpx, sourceApp } = req.body;
    const track = await prisma.track.create({
      data: { sessionId, boatLabel, startSec, pointCount, gridJson, rawGpx, sourceApp },
    });

    // gridJson/rawGpxを除くメタのみ返す（ARCH.md §4）
    const { gridJson: _g, rawGpx: _r, ...meta } = track;
    res.status(201).json({ track: meta });
  }
);

// POST /api/sessions/:id/annotations — 注釈追加（T-15, ARCH.md §4。本エンドポイントが唯一の作成担当）
router.post(
  "/:id/annotations",
  authMiddleware,
  requireSessionTeamMember(),
  async (req: SessionScopedRequest, res: Response): Promise<void> => {
    const sessionId = req.sessionRecord!.id;
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      res.status(404).json({ error: "セッションが見つかりません" });
      return;
    }

    const result = validateAnnotationPayload(req.body, session.durationSec);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const { tSec, body, trackId, legIndex } = req.body;

    if (trackId !== undefined && trackId !== null) {
      const track = await prisma.track.findUnique({ where: { id: trackId } });
      if (!track || track.sessionId !== sessionId) {
        res.status(400).json({ error: "trackId がこのセッションに属していません" });
        return;
      }
    }

    const annotation = await prisma.annotation.create({
      data: {
        sessionId,
        authorId: req.userId as number,
        tSec,
        body,
        trackId: trackId ?? null,
        legIndex: legIndex ?? null,
      },
    });

    res.status(201).json({ annotation });
  }
);

export default router;
