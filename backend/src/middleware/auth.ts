import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: number;
}

/**
 * 署名の検証だけを行う軽量ゲート（DBアクセスなし）。
 *
 * レビュー指摘（2026-08-04・PR #53）: express.json は認証より前に動くため、
 * /api/sessions の上限を24MBへ上げると、**未認証の第三者でも24MBの本文を
 * サーバにパースさせられる**。登録が誰でも通る以上、メモリ負荷の入口になる。
 *
 * 本文をパースする前にこれを挟み、トークンの署名すら通らないリクエストは
 * 本文を読まずに401で落とす。ここでは isActive のDB確認をしない
 * （入口の門番に徹する。実際の認可は後段の authMiddleware が担う。
 * ここでDBを引くと1リクエストにつきクエリが二重になるため）。
 */
export function requireBearerSignature(req: AuthRequest, res: Response, next: NextFunction): void {
  // 本文を持たないメソッドは素通しする。
  // 目的は「本文をパースする前に落とす」ことなので、GET/HEAD/OPTIONS を止める理由がない。
  // かつ、ここで止めると T-31（ADR-007）の設計を壊す:
  //   GET /api/tracks/:id/gpx は未認証を401ではなく404にする決まりで
  //   （401だと「存在するが認証が要る」と示唆してしまい公開/非公開の境界が漏れる）、
  //   このゲートが先に401を返すとその意図が無効になる。実際にt31の回帰テストで検出した。
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "認証トークンがありません" });
    return;
  }
  try {
    jwt.verify(authHeader.slice(7), process.env.JWT_SECRET as string);
    next();
  } catch {
    res.status(401).json({ error: "トークンが無効または期限切れです" });
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "認証トークンがありません" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "トークンが無効または期限切れです" });
  }
}

// T-31（ARCH.md §4）: GET /api/tracks/:id/gpx は未認証を404にする（401にすると
// 「存在するリソースだが認証が要る」ことを示唆してしまい、公開/非公開の境界情報が漏れるため）。
// authMiddleware と判定ロジックは同じだが、失敗時のレスポンスのみ404にする。
export function authMiddlewareOr404(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const notFound = () => res.status(404).json({ error: "トラックが見つかりません" });

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    notFound();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch {
    notFound();
  }
}
