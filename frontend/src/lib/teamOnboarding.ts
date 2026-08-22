// T-34 (Issue #34): /teams（チーム作成・招待参加）ページが使う純関数。
// slugのバリデーション正規表現は backend/src/routes/teams.ts の TEAM_SLUG_RE と同一にする
// （クライアント側での早期エラー表示用。最終的な真偽はbackendが判定する）。
const TEAM_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/;

/** チーム名からslug候補を生成する。半角英数字以外はハイフンに変換し、連続・前後のハイフンを畳む。 */
export function slugifyTeamName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug;
}

/** backendのslug要件（半角英小文字・数字・ハイフン、3文字以上）を満たすか。 */
export function isValidTeamSlug(slug: string): boolean {
  return TEAM_SLUG_RE.test(slug);
}
