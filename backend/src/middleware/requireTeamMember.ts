import { Response, NextFunction } from "express";
import prisma from "../database";
import { AuthRequest } from "./auth";

// ARCH.md §4: 「呼び出しユーザーが session.teamId の TeamMember であることをミドルウェアで検証」
// (部内限定共有の実体)。authMiddleware の後段で使う前提（req.userId が設定済み）。

export interface SessionScopedRequest extends AuthRequest {
  sessionRecord?: { id: number; teamId: number; uploaderId: number };
}

export async function isTeamMember(userId: number, teamId: number): Promise<boolean> {
  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  return member !== null;
}

async function isTeamAdmin(userId: number, teamId: number): Promise<boolean> {
  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  return member?.role === "admin";
}

/** body.teamId を対象に、呼び出しユーザーがTeamMemberであることを検証する（POST /api/sessions用） */
export function requireTeamMemberByBody() {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const teamId = Number(req.body?.teamId);
    if (!teamId || !Number.isInteger(teamId)) {
      res.status(400).json({ error: "teamId は必須です" });
      return;
    }
    const ok = await isTeamMember(req.userId as number, teamId);
    if (!ok) {
      res.status(403).json({ error: "このチームのメンバーではありません" });
      return;
    }
    next();
  };
}

/**
 * URLの :id が指す Session を取得し、呼び出しユーザーがその session.teamId の
 * TeamMember であることを検証する。以後のハンドラで再取得しなくて済むよう req.sessionRecord に載せる。
 */
export function requireSessionTeamMember() {
  return async (req: SessionScopedRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "不正なセッションIDです" });
      return;
    }
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      res.status(404).json({ error: "セッションが見つかりません" });
      return;
    }
    const ok = await isTeamMember(req.userId as number, session.teamId);
    if (!ok) {
      res.status(403).json({ error: "このチームのメンバーではありません" });
      return;
    }
    req.sessionRecord = { id: session.id, teamId: session.teamId, uploaderId: session.uploaderId };
    next();
  };
}

/** DELETE等: uploader本人 または Team admin のみ許可 */
export async function isUploaderOrTeamAdmin(
  userId: number,
  session: { teamId: number; uploaderId: number }
): Promise<boolean> {
  if (session.uploaderId === userId) return true;
  return isTeamAdmin(userId, session.teamId);
}
