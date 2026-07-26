// T-31: 認証不要の公開取得API（ARCH.md §4・SPEC-share1-phase1.md §5.1・ADR-007）。
// 「本スライスの安全性の要」。既存 GET /api/sessions/:id のレスポンス整形は再利用せず、
// 専用のホワイトリスト・シリアライザ(serializePublicSession)を使う。
import { Router, Request, Response } from "express";
import prisma from "../database";
import { checkRateLimit, shouldCountView } from "../lib/rateLimiter";
import { serializePublicSession } from "../lib/serializePublicSession";

const router = Router();

// 存在しない/非公開/取り消し済みを区別しない一律404（レスポンスボディも同一。ADR-007）
function notFound(res: Response): void {
  res.status(404).json({ error: "セッションが見つかりません" });
}

// Quality Gate Major1修正: このルートはNext.jsのサーバーコンポーネントから叩かれるため、
// req.ip は常に「Next.jsサーバー1台のIP」になり、レート制限/閲覧数カウントが実質1ユーザー分に
// 潰れる（発見事項参照）。frontend/src/lib/publicSession.ts が転送する x-forwarded-client-ip
// （Next側で受け取った本来のx-forwarded-for/x-real-ipの先頭値）があればそれを優先する。
// 限界: backendへ直接到達できる呼び出し元はこのヘッダを任意に詐称できる（Next経由を強制しない）。
// 本番(Render)でもbackendは公開URLを持つため同じ限界が残るが、Major1の実害
// （1台のIPに潰れて機能しないこと）は解消できるため、詐称リスクは発見事項に明記の上で許容する。
function clientIp(req: Request): string {
  const forwarded = req.header("x-forwarded-client-ip");
  if (forwarded) return forwarded;
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

// GET /api/public/sessions/:slug — 認証不要
router.get("/sessions/:slug", async (req: Request, res: Response): Promise<void> => {
  const ip = clientIp(req);

  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "リクエストが多すぎます。しばらくしてから再度お試しください" });
    return;
  }

  const { slug } = req.params;
  if (typeof slug !== "string" || slug.length === 0) {
    notFound(res);
    return;
  }

  const session = await prisma.session.findUnique({
    where: { publicSlug: slug },
    select: {
      id: true,
      title: true,
      type: true,
      startedAt: true,
      durationSec: true,
      venue: true,
      learningSummary: true,
      legs: true,
      visibility: true,
      publishedAt: true,
      team: { select: { name: true } },
    },
  });

  // 存在しない/取り消し済み(publicSlug=null後は元々ヒットしない)/非公開("team")を一律404で区別しない
  if (!session || session.visibility === "team") {
    notFound(res);
    return;
  }

  const [tracks, annotations] = await Promise.all([
    prisma.track.findMany({
      where: { sessionId: session.id },
      select: {
        id: true,
        boatLabel: true,
        startSec: true,
        pointCount: true,
        gridJson: true,
        sourceApp: true,
        // rawGpxは選択しない(SELECT自体に含めない)
      },
    }),
    prisma.annotation.findMany({
      where: { sessionId: session.id, isPublic: true },
      orderBy: { tSec: "asc" },
      select: {
        id: true,
        tSec: true,
        trackId: true,
        legIndex: true,
        body: true,
        // authorId/isPublic/createdAtは選択しない
      },
    }),
  ]);

  if (shouldCountView(ip, slug)) {
    // 加算はレスポンスをブロックしない範囲でベストエフォート（失敗しても閲覧自体は継続させる）
    prisma.session
      .update({ where: { id: session.id }, data: { publicViewCount: { increment: 1 } } })
      .catch(() => undefined);
  }

  res.status(200).json(serializePublicSession(session, tracks, annotations));
});

export default router;
