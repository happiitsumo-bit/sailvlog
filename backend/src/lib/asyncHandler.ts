// Quality Gate Major2修正: Express 4 + Node 20 では async ハンドラ内で reject した Promise が
// next(err) へ自動で渡らず、未処理rejectionとしてプロセスごと落ちる（DB例外1回でAPI全断＋cold start）。
// Team Lead裁定（2026-07-26）: 新規npm依存（express-async-errors等）は不可、依存ゼロで解決する。
// この wrap() は async ハンドラを .catch(next) で包むだけの薄い関数で、外部依存はゼロ。
// 各ルートの個別ロジック（try/catchの中身）を書き換える必要はなく、
// router.get("/path", wrap(async (req, res) => {...})) のように既存の関数をそのまま包めばよい。
import { NextFunction, Request, RequestHandler, Response } from "express";

export function wrap<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as Req, res, next)).catch(next);
  };
}
