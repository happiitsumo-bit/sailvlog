import { Router, Request, Response } from "express";

const router = Router();

// B-02修正（2026-07-27, REVIEW-backend-2.md・案B）: このルータはチーム横断で全ユーザーの
// specialty/affiliation/experienceYears等を返す。以前はauthMiddlewareだけで守っていたが、
// POST /api/auth/register が誰でも通るため「ログイン済みか」は「無関係な第三者かどうか」を
// 弁別できない。しかも「チームメンバーか」で判定しようにも、このエンドポイントの用途自体が
// チーム横断検索であり「関係にある」を定義できない。v3 frontendからの利用はゼロ（grep済み・
// ヒット0）なので、ADR-003の凍結ルートと同じ方針（410 Gone）に揃えて凍結する。
// 復活させる場合は、招待制registerや「セーラー検索を許可する明示的な関係」の設計が前提になる。
const gone = (_req: Request, res: Response) => {
  res.status(410).json({ error: "このエンドポイントはv3ピボットにより凍結されました" });
};

router.all("/", gone);
router.all("/:username", gone);

export default router;
