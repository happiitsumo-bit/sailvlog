// M3-05修正（2026-07-28, REVIEW-backend-3.md）: publicViewCountはPRD §6により
// 「SQLでのみ参照・APIにも画面にも出さない」非KPI項目。GET /api/sessions/:id（R-02）・
// GET /api/sessions一覧（M-02）ではそれぞれ個別にselect/destructureで除外していたが、
// POST/PATCH /api/sessions は prisma.session.create/update の戻り値をそのまま返しており
// 同じ指摘が3回目出ていた（一貫性の欠如が構造的に再発していた）。
// 「これから増える書き込み系エンドポイントでも同じ取りこぼしが起きない」ようにするため、
// Session行を返す全経路（GET :id・POST・PATCH）でこの関数に一本化する。
//
// Prisma Session型を直接importせず構造的部分型（publicViewCountを含むオブジェクト）で受けることで、
// prisma/generated配下の生成型に対するimport循環を避けつつ、呼び出し側の戻り値型をそのまま渡せる。
export function serializeSession<T extends { publicViewCount: unknown }>(
  session: T
): Omit<T, "publicViewCount"> {
  const { publicViewCount: _publicViewCount, ...rest } = session;
  return rest;
}
