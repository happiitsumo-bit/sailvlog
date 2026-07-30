import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: number;
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
