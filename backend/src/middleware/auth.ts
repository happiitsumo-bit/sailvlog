import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../database";

export interface AuthRequest extends Request {
  userId?: number;
}

/**
 * JWTを検証し、さらに「そのユーザーが今も有効か」をDBで確認する。
 *
 * 署名の検証だけでは不十分な理由（Issue #22 レビュー指摘）:
 * アカウント削除は `User.isActive = false` のソフトデリートで、ユーザー行自体は残る。
 * 署名しか見ないと、削除直前に発行されたJWT（有効期限2時間）で削除後も認証済みAPIを
 * 呼び続けられ、チーム作成のような書き込みまで通ってしまう。
 * 将来の凍結・BANでも同じ穴が開くため、削除APIの側ではなく認証の入口で塞ぐ。
 *
 * 代償として全認証リクエストにクエリが1本増える。id検索の1行なので影響は小さいが、
 * cold start と p95 の実測（Issue #10）では、この変更が入った後の値を見ること。
 */
async function resolveActiveUserId(token: string): Promise<number | null> {
  let payload: { userId: number };
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  return user.id;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "認証トークンがありません" });
    return;
  }

  const unauthorized = () => res.status(401).json({ error: "トークンが無効または期限切れです" });

  // このミドルウェアは wrap() を通さずに直接マウントされている箇所が多いため、
  // 例外を内部で握って必ずレスポンスを返す（未処理rejectionでリクエストがハングするのを防ぐ）。
  try {
    const userId = await resolveActiveUserId(authHeader.slice(7));
    if (userId === null) {
      unauthorized();
      return;
    }
    req.userId = userId;
    next();
  } catch (err) {
    console.error("authMiddleware failed:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// T-31（ARCH.md §4）: GET /api/tracks/:id/gpx は未認証を404にする（401にすると
// 「存在するリソースだが認証が要る」ことを示唆してしまい、公開/非公開の境界情報が漏れるため）。
// authMiddleware と判定ロジックは同じだが、失敗時のレスポンスのみ404にする。
export async function authMiddlewareOr404(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const notFound = () => res.status(404).json({ error: "トラックが見つかりません" });

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    notFound();
    return;
  }

  try {
    const userId = await resolveActiveUserId(authHeader.slice(7));
    if (userId === null) {
      notFound();
      return;
    }
    req.userId = userId;
    next();
  } catch (err) {
    console.error("authMiddlewareOr404 failed:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
