import { Router, Response } from "express";
import crypto from "crypto";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import {
  requireTeamMemberByBody,
  requireSessionTeamMember,
  isUploaderOrTeamAdmin,
  SessionScopedRequest,
} from "../middleware/requireTeamMember";
import { validateTrackPayload, TrackPayloadInput } from "../lib/validateTrackPayload";
import { validateAnnotationPayload } from "../lib/validateAnnotationPayload";
import { validatePublishPayload } from "../lib/validatePublishPayload";
import { validateSessionPatchPayload } from "../lib/validateSessionPatchPayload";
import { serializeSession } from "../lib/serializeSession";
import { wrap } from "../lib/asyncHandler";

const router = Router();

const MAX_DURATION_SEC = 14400; // 4時間（ARCH.md §3）
const MAX_TITLE_LEN = 255;

// 公開URL(/p/[slug])のオリジン。専用の新規env変数を足さず、既存のCORS_ORIGIN(フロントの許可オリジン)の
// 先頭値を流用する（T-30・ARCH §4「新規npm依存なし」の精神を環境変数追加の抑制にも適用）。
function publicOrigin(): string {
  const first = (process.env.CORS_ORIGIN ?? "http://localhost:3001").split(",")[0]?.trim();
  return first || "http://localhost:3001";
}

function generatePublicSlug(): string {
  // crypto.randomBytes(9).toString("base64url") — Node標準・新規npm依存なし（T-30・ARCH ADR-007）
  return crypto.randomBytes(9).toString("base64url");
}

// POST /api/sessions — 新規セッション作成。
// 任意で tracks（艇ごとのトラック配列）を同時に渡すと、セッション作成とトラック投入を
// 1トランザクションにまとめる（Issue #40・REVIEW-codex.md C-05修正案(b)）。
// 複数艇アップロードの途中失敗でセッションと先行トラックだけが残る事故を、
// フロント側のロールバックではなくDBのアトミック性で構造的に防ぐ。
// tracksを省略した場合は従来どおりセッションのみ作成する（後方互換）。
router.post(
  "/",
  authMiddleware,
  // C-03修正（Issue #39）: async ミドルウェアはwrap()の外だとreject時にリクエストがハングする。
  wrap(requireTeamMemberByBody()),
  wrap(async (req: AuthRequest, res: Response): Promise<void> => {
    const { title, type, startedAt, durationSec, teamId, venue, notes, tracks } = req.body;

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

    let trackInputs: Array<{
      boatLabel: string;
      startSec: number;
      pointCount: number;
      gridJson: object;
      rawGpx: string;
      sourceApp?: string;
    }> = [];
    if (tracks !== undefined) {
      if (!Array.isArray(tracks) || tracks.length === 0) {
        res.status(400).json({ error: "tracks を指定する場合は1件以上の配列である必要があります" });
        return;
      }
      for (let i = 0; i < tracks.length; i++) {
        const result = validateTrackPayload(tracks[i] as TrackPayloadInput, durationSec);
        if (!result.ok) {
          res.status(result.status).json({ error: `tracks[${i}]: ${result.error}` });
          return;
        }
      }
      trackInputs = tracks;
    }

    const { session, trackMetas } = await prisma.$transaction(async (tx) => {
      const session = await tx.session.create({
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

      const trackMetas: unknown[] = [];
      for (const t of trackInputs) {
        const track = await tx.track.create({
          data: {
            sessionId: session.id,
            boatLabel: t.boatLabel,
            startSec: t.startSec,
            pointCount: t.pointCount,
            gridJson: t.gridJson,
            rawGpx: t.rawGpx,
            sourceApp: t.sourceApp,
          },
        });
        // gridJson/rawGpxを除くメタのみ返す（単一トラック投入エンドポイントと同じ整形。ARCH.md §4）
        const { gridJson: _g, rawGpx: _r, ...meta } = track;
        trackMetas.push(meta);
      }

      return { session, trackMetas };
    });

    // M3-05修正: publicViewCountはPRD §6により非公開。共通シリアライザで一貫して除外する。
    res.status(201).json({ session: serializeSession(session), tracks: trackMetas });
  })
);

// GET /api/sessions?teamId= — チームのセッション一覧（メタのみ）
router.get("/", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
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

  // M-02修正（2026-07-27, REVIEW-backend-2.md）: 以前はselect無しのfindMany+includeで
  // Sessionの全スカラーカラム（publicViewCount・publishedById等）が返っていた。
  // publicViewCountはPRD §6により「APIにも画面にも出さない」非KPI項目（詳細側
  // GET /api/sessions/:id は既にR-02で除外済みだったが、一覧側だけ取りこぼしていた）。
  // 「除外するものを列挙」ではなく「含めるものだけを列挙する」方式（公開API
  // serializePublicSession.tsと同じ規律）に直すことで、将来カラムが増えても
  // 同じ取りこぼしが構造的に起きないようにする。一覧に不要なnotes/marks/legs/
  // publicSlug/learningSummary/publishedAt/publishedById/publicViewCountは
  // そもそもクエリに含めない（frontend/src/types/index.ts の SessionSummary が
  // 要求するフィールドのみ）。
  const sessions = await prisma.session.findMany({
    where: { teamId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      startedAt: true,
      durationSec: true,
      venue: true,
      createdAt: true,
      teamId: true,
      uploaderId: true,
      visibility: true,
      _count: { select: { tracks: true, annotations: true } },
    },
  });

  res.json({ sessions });
}));

// GET /api/sessions/:id — 詳細（tracksはgridJson込み・rawGpx除外、annotations込み）
router.get(
  "/:id",
  authMiddleware,
  // C-03修正（Issue #39, 横断確認）: requireTeamMemberByBody()と同型の未wrap async middleware。
  wrap(requireSessionTeamMember()),
  wrap(async (req: SessionScopedRequest, res: Response): Promise<void> => {
    const id = req.sessionRecord!.id;

    const [sessionRow, tracks, annotations] = await Promise.all([
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

    // Quality Gate Major修正: publicViewCountはPRD §6により「SQLでのみ参照・UI表示や成功指標にしない」
    // と定められている非KPI項目。部内API(GET /api/sessions/:id)のレスポンスから除外する。
    // M3-05修正: 除外ロジックをlib/serializeSession.tsに一本化（POST/PATCHと同じ関数を使う）。
    res.json({ session: sessionRow ? serializeSession(sessionRow) : null, tracks, annotations });
  })
);

// PATCH /api/sessions/:id — title/notes/marks/legsの更新（レグ境界の保存・補正）
router.patch(
  "/:id",
  authMiddleware,
  // C-03修正（Issue #39, 横断確認）: requireTeamMemberByBody()と同型の未wrap async middleware。
  wrap(requireSessionTeamMember()),
  wrap(async (req: SessionScopedRequest, res: Response): Promise<void> => {
    const { title, notes, marks, legs } = req.body;
    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0 || title.length > MAX_TITLE_LEN) {
        res.status(400).json({ error: `title は1〜${MAX_TITLE_LEN}文字である必要があります` });
        return;
      }
      data.title = title.trim();
    }

    // M-06修正: notes/marks/legsは以前無検証で素通ししていた。legsは公開ページにも出るため
    // 構造検証を通す（他のJson列と同じ扱いに揃える）。
    const validation = validateSessionPatchPayload({ notes, marks, legs });
    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.error });
      return;
    }
    if (notes !== undefined) data.notes = notes;
    if (marks !== undefined) data.marks = marks;
    if (legs !== undefined) data.legs = legs;

    const session = await prisma.session.update({
      where: { id: req.sessionRecord!.id },
      data,
    });

    // M3-05修正: publicViewCountはPRD §6により非公開。共通シリアライザで一貫して除外する。
    res.json({ session: serializeSession(session) });
  })
);

// DELETE /api/sessions/:id — uploader本人 または Team admin のみ（Track/Annotationカスケード）
router.delete(
  "/:id",
  authMiddleware,
  // C-03修正（Issue #39, 横断確認）: requireTeamMemberByBody()と同型の未wrap async middleware。
  wrap(requireSessionTeamMember()),
  wrap(async (req: SessionScopedRequest, res: Response): Promise<void> => {
    const allowed = await isUploaderOrTeamAdmin(req.userId as number, req.sessionRecord!);
    if (!allowed) {
      res.status(403).json({ error: "削除できるのはアップロード者本人またはチーム管理者のみです" });
      return;
    }
    await prisma.session.delete({ where: { id: req.sessionRecord!.id } });
    res.status(204).send();
  })
);

// POST /api/sessions/:id/tracks — 艇1つぶんのトラック投稿（構造検証込み。ARCH.md §4）
router.post(
  "/:id/tracks",
  authMiddleware,
  // C-03修正（Issue #39, 横断確認）: requireTeamMemberByBody()と同型の未wrap async middleware。
  wrap(requireSessionTeamMember()),
  wrap(async (req: SessionScopedRequest, res: Response): Promise<void> => {
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
  })
);

// POST /api/sessions/:id/annotations — 注釈追加（T-15, ARCH.md §4。本エンドポイントが唯一の作成担当）
router.post(
  "/:id/annotations",
  authMiddleware,
  // C-03修正（Issue #39, 横断確認）: requireTeamMemberByBody()と同型の未wrap async middleware。
  wrap(requireSessionTeamMember()),
  wrap(async (req: SessionScopedRequest, res: Response): Promise<void> => {
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
  })
);

// POST /api/sessions/:id/publish — 公開昇格（T-30, ARCH.md §4/ADR-007）。
// 権限はuploader本人 or Team adminのみ。再公開のたびに新しいスラッグを発行する（前と異なるスラッグ＝1方向解釈）。
router.post(
  "/:id/publish",
  authMiddleware,
  // C-03修正（Issue #39, 横断確認）: requireTeamMemberByBody()と同型の未wrap async middleware。
  wrap(requireSessionTeamMember()),
  wrap(async (req: SessionScopedRequest, res: Response): Promise<void> => {
    const sessionId = req.sessionRecord!.id;

    const allowed = await isUploaderOrTeamAdmin(req.userId as number, req.sessionRecord!);
    if (!allowed) {
      res.status(403).json({ error: "公開できるのはアップロード者本人またはチーム管理者のみです" });
      return;
    }

    const result = validatePublishPayload(req.body);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const { visibility, learningSummary, publicAnnotationIds } = req.body as {
      visibility: "unlisted" | "public";
      learningSummary: string;
      publicAnnotationIds?: number[];
    };
    const ids = publicAnnotationIds ?? [];

    if (ids.length > 0) {
      const matched = await prisma.annotation.count({
        where: { id: { in: ids }, sessionId },
      });
      if (matched !== ids.length) {
        res.status(400).json({ error: "publicAnnotationIds に他セッションの注釈IDが含まれています" });
        return;
      }
    }

    // 前と異なるスラッグを毎回発行する。理論上の衝突（@unique制約違反）に備え数回だけ再試行する。
    let publicSlug = generatePublicSlug();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.session.findUnique({ where: { publicSlug } });
      if (!clash) break;
      publicSlug = generatePublicSlug();
    }

    const [session] = await prisma.$transaction([
      prisma.session.update({
        where: { id: sessionId },
        data: {
          visibility,
          learningSummary: learningSummary.trim(),
          publicSlug,
          publishedAt: new Date(),
          publishedById: req.userId as number,
        },
      }),
      // 既定=非公開に一度戻してから、選ばれたものだけ公開にする（再公開時に前回選択が残らないようにする）
      prisma.annotation.updateMany({ where: { sessionId }, data: { isPublic: false } }),
      ...(ids.length > 0
        ? [prisma.annotation.updateMany({ where: { sessionId, id: { in: ids } }, data: { isPublic: true } })]
        : []),
    ]);

    res.status(200).json({
      publicSlug: session.publicSlug,
      publicUrl: `${publicOrigin()}/p/${session.publicSlug}`,
      visibility: session.visibility,
      publishedAt: session.publishedAt,
    });
  })
);

// POST /api/sessions/:id/unpublish — 公開取り消し（T-30）。publicSlugを破棄しvisibilityを"team"へ戻す。
router.post(
  "/:id/unpublish",
  authMiddleware,
  // C-03修正（Issue #39, 横断確認）: requireTeamMemberByBody()と同型の未wrap async middleware。
  wrap(requireSessionTeamMember()),
  wrap(async (req: SessionScopedRequest, res: Response): Promise<void> => {
    const allowed = await isUploaderOrTeamAdmin(req.userId as number, req.sessionRecord!);
    if (!allowed) {
      res.status(403).json({ error: "取り消せるのはアップロード者本人またはチーム管理者のみです" });
      return;
    }

    const session = await prisma.session.update({
      where: { id: req.sessionRecord!.id },
      data: { visibility: "team", publicSlug: null, publishedAt: null },
    });

    res.status(200).json({ visibility: session.visibility });
  })
);

export default router;
