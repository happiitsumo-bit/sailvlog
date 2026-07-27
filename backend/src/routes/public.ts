// T-31: 認証不要の公開取得API（ARCH.md §4・SPEC-share1-phase1.md §5.1・ADR-007）。
// 「本スライスの安全性の要」。既存 GET /api/sessions/:id のレスポンス整形は再利用せず、
// 専用のホワイトリスト・シリアライザ(serializePublicSession)を使う。
import { Router, Request, Response } from "express";
import crypto from "crypto";
import prisma from "../database";
import { checkRateLimit, shouldCountView } from "../lib/rateLimiter";
import { serializePublicSession } from "../lib/serializePublicSession";
import { wrap } from "../lib/asyncHandler";

const router = Router();

// qa-engineer/implementer (T-90 flaky根絶, 2026-07-28): 下の「閲覧数加算」は本番では意図的に
// fire-and-forget（awaitせずレスポンスをブロックしない）。だがテストのbeforeEachが次のTRUNCATEを
// 発行する前にこの書き込みが必ず片付いている保証がなく、それが決定的でないflaky failureの原因
// だった（詳細は__tests__/helpers/resetDb.tsとsetup/resetDbHook.tsのコメント参照）。
// 対策として「今まさに実行中のバックグラウンド処理」をここに登録しておき、テスト側だけが
// それを待てるようにする。本番の応答経路には一切影響しない（登録・削除がPromiseに追加されるだけ）。
const pendingBackgroundWork = new Set<Promise<unknown>>();

function trackBackgroundWork(work: Promise<unknown>): void {
  pendingBackgroundWork.add(work);
  const clear = (): void => {
    pendingBackgroundWork.delete(work);
  };
  work.then(clear, clear);
}

// テスト専用: 現在実行中の全バックグラウンド処理(fire-and-forget)の完了を待つ。
// 本番コードからは呼ばれない(テストのresetDbHook.tsのbeforeEachからのみ使用)。
export function awaitPendingBackgroundWork(): Promise<unknown> {
  return Promise.allSettled(Array.from(pendingBackgroundWork));
}

// 存在しない/非公開/取り消し済みを区別しない一律404（レスポンスボディも同一。ADR-007）
function notFound(res: Response): void {
  res.status(404).json({ error: "セッションが見つかりません" });
}

// Quality Gate Major1修正: このルートはNext.jsのサーバーコンポーネントから叩かれるため、
// req.ip は常に「Next.jsサーバー1台のIP」になり、レート制限/閲覧数カウントが実質1ユーザー分に
// 潰れる（発見事項参照）。frontend/src/lib/publicSession.ts が転送する x-forwarded-client-ip
// （Next側で受け取った本来のx-forwarded-for/x-real-ipの先頭値）があればそれを優先する。
//
// Team Lead指摘(R-03残穴): 上記ヘッダは、backendのポートへ直接到達できる呼び出し元なら誰でも
// 詐称できてしまう。publicViewCountはPRD §6で共有1→共有2のゲート判定に使う数値であり、
// 「ヘッダを回すだけでレート制限を回避し、閲覧数を偽装できる」のは看過できないリスクと判断された。
// 対策: Next.jsサーバーのみが知る共有シークレットを別ヘッダ(x-internal-proxy-secret)で同送させ、
// 一致した場合のみ x-forwarded-client-ip を採用する。
//
// 【Codexへの申し送り: フロント側が満たすべきヘッダ仕様】
//   - ヘッダ名: `x-internal-proxy-secret`（クライアントIPを積む `x-forwarded-client-ip` とは別ヘッダ）
//   - 値: 環境変数 `INTERNAL_PROXY_SECRET` の値をそのまま文字列で送る（バックエンドの
//     `process.env.INTERNAL_PROXY_SECRET` と完全一致する文字列。ハッシュ化や加工は不要）
//   - 送信元: frontend/src/lib/publicSession.ts の `fetchPublicSession`（サーバーコンポーネントの
//     fetchのみ。ブラウザから直接backendを叩く経路は無いので、ブラウザにこのシークレットが
//     渡ることは無い＝NEXT_PUBLIC_ プレフィックスを付けてはいけない）
//   - 未設定時の挙動（安全側のデフォルト）: backend側で `INTERNAL_PROXY_SECRET` が未設定、
//     もしくはヘッダ値が不一致の場合は `x-forwarded-client-ip` を一切信用せず、`req.ip` に
//     フォールバックする（＝docker-compose公開ポート越しにbackendへ直接投げても、
//     クライアントIP詐称もレート制限回避もできない）
function proxySecretMatches(req: Request): boolean {
  const expected = process.env.INTERNAL_PROXY_SECRET;
  if (!expected) return false; // 未設定なら常に不一致扱い(安全側)
  const provided = req.header("x-internal-proxy-secret");
  if (!provided) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  // 長さが違うとtimingSafeEqualが例外を投げるため先にlengthを揃える(定数時間比較を維持する目的で
  // 「不一致」を早期returnせず、同じ長さのダミーバッファと比較してから結果を返す)
  if (expectedBuf.length !== providedBuf.length) {
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

function clientIp(req: Request): string {
  const forwarded = req.header("x-forwarded-client-ip");
  if (forwarded && proxySecretMatches(req)) return forwarded;
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

// GET /api/public/sessions/:slug — 認証不要
// Quality Gate Major2修正: wrap()でasyncハンドラの例外をグローバルエラーハンドラへ確実に渡す
// （このルートは未認証で誰でも叩けるため、安全網の必要性が特に高い）
router.get("/sessions/:slug", wrap(async (req: Request, res: Response): Promise<void> => {
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
    // 加算はレスポンスをブロックしない範囲でベストエフォート（失敗しても閲覧自体は継続させる）。
    // trackBackgroundWork()での登録はテストの決定的な待ち合わせのためだけに存在し、
    // レスポンスは従来どおりこのPromiseの完了を待たずに返る。
    trackBackgroundWork(
      prisma.session
        .update({ where: { id: session.id }, data: { publicViewCount: { increment: 1 } } })
        .catch(() => undefined),
    );
  }

  res.status(200).json(serializePublicSession(session, tracks, annotations));
}));

export default router;
