import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../database";
import { wrap } from "../lib/asyncHandler";

const router = Router();

// JWTの有効期限。@types/jsonwebtoken 9系は expiresIn を `number | StringValue`（"2h" 等の
// テンプレートリテラル型）で受けるため、環境変数由来の素の string はそのままでは渡せない。
// 値の妥当性は実行時にjsonwebtoken側が検証する（不正な文字列は sign() が例外を投げる）。
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? "30m") as jwt.SignOptions["expiresIn"];

// POST /api/auth/register
// Quality Gate Major2修正: wrap()でasyncハンドラの例外をグローバルエラーハンドラへ確実に渡す
router.post("/register", wrap(async (req: Request, res: Response): Promise<void> => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ error: "username, email, password は必須です" });
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
router.post("/login", wrap(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "email と password は必須です" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
    return;
  }

  const valid = await bcrypt.compare(password, user.hashedPassword);
  if (!valid) {
    res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
    return;
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN });

  res.json({
    user: { id: user.id, username: user.username, email: user.email },
    token,
  });
}));

export default router;
