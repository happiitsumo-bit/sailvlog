import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../database";
import { wrap } from "../lib/asyncHandler";
import {
  peekAuthEmailRateLimit,
  recordAuthEmailFailure,
  checkAuthIpRateLimit,
  checkRegisterRateLimit,
} from "../lib/rateLimiter";
import { validateRegisterPayload } from "../lib/validateRegisterPayload";

const router = Router();

// JWTの有効期限。@types/jsonwebtoken 9系は expiresIn を `number | StringValue`（"2h" 等の
// テンプレートリテラル型）で受けるため、環境変数由来の素の string はそのままでは渡せない。
// 値の妥当性は実行時にjsonwebtoken側が検証する（不正な文字列は sign() が例外を投げる）。
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? "30m") as jwt.SignOptions["expiresIn"];

// POST /api/auth/register
// Quality Gate Major2修正: wrap()でasyncハンドラの例外をグローバルエラーハンドラへ確実に渡す
// M3-02修正（2026-07-28, REVIEW-backend-3.md）: レート制限が無く、bcrypt.hash(cost 12)を
// 高頻度で叩くとlibuvスレッドプールが飽和する（詳細はlib/rateLimiter.tsのコメント）。
router.post("/register", wrap(async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (!checkRegisterRateLimit(ip)) {
    res.status(429).json({ error: "リクエストが多すぎます。しばらくしてから再度お試しください" });
    return;
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ error: "username, email, password は必須です" });
    return;
  }

  // m-05修正（2026-07-27, REVIEW-backend-2.md）: 「存在すること」だけでなく形式・長さも検証する
  // （根拠は lib/validateRegisterPayload.ts のコメント参照）。
  const validation = validateRegisterPayload({ username, email, password });
  if (!validation.ok) {
    res.status(validation.status).json({ error: validation.error });
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    res.status(409).json({ error: "そのユーザー名またはメールアドレスは既に使われています" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email, hashedPassword },
    select: { id: true, username: true, email: true, createdAt: true },
  });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN });

  res.status(201).json({ user, token });
}));

// POST /api/auth/login
// M-04修正（2026-07-27, REVIEW-backend-2.md）: レート制限が無く、bcrypt cost 12と組み合わさって
// 単一インスタンスを飽和させられる/総当たりが無制限にできる問題があった。
// B3-01修正（2026-07-28, REVIEW-backend-3.md）: M-04のIP単位10回/60秒は、部室の共有Wi-Fi/大学NAT
// 配下で反省会当日に部員全員を巻き込んで弾く欠陥があった（詳細はlib/rateLimiter.tsのコメント）。
// email単位を総当たり対策の本体にし、IP単位はDoSの蓋としてのみ緩く残す。
router.post("/login", wrap(async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const { email, password } = req.body;
  const emailKey = typeof email === "string" ? email.trim().toLowerCase() : "";

  // IP単位: DoSの蓋（成功/失敗を問わず全試行を消費）。
  if (!checkAuthIpRateLimit(ip)) {
    res.status(429).json({ error: "リクエストが多すぎます。しばらくしてから再度お試しください" });
    return;
  }
  // email単位: 総当たり対策の本体。判定のみ（消費は失敗時にrecordAuthEmailFailureで行う）。
  if (emailKey && !peekAuthEmailRateLimit(emailKey)) {
    res.status(429).json({ error: "ログイン試行回数が多すぎます。しばらくしてから再度お試しください" });
    return;
  }

  if (!email || !password) {
    res.status(400).json({ error: "email と password は必須です" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    if (emailKey) recordAuthEmailFailure(emailKey);
    res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
    return;
  }

  const valid = await bcrypt.compare(password, user.hashedPassword);
  if (!valid) {
    if (emailKey) recordAuthEmailFailure(emailKey);
    res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
    return;
  }

  // ログイン成功はカウントを消費しない（B3-01修正）。
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN });

  res.json({
    user: { id: user.id, username: user.username, email: user.email },
    token,
  });
}));

export default router;
