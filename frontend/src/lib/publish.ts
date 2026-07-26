// T-32: 公開昇格ダイアログ・チップまわりの純関数（SPEC-share1-phase1.md §3.1 F-1〜F-3, UI-DESIGN §5.2）。
// DOM/APIに依存しないためユニットテスト対象（t32-publish.test.ts）。

export const LEARNING_SUMMARY_MAX = 400;

/** 「公開する」ボタンを描画してよいか（uploader本人 or Team admin のみ。UI-DESIGN §5.2）。
    未ログイン（currentUserId=null）は常にfalse。 */
export function canManageSession(
  uploaderId: number,
  currentUserId: number | null,
  isTeamAdmin: boolean
): boolean {
  if (currentUserId === null) return false;
  return currentUserId === uploaderId || isTeamAdmin;
}

/** 学びの要約の残り文字数（マイナスは超過を意味する。UI-DESIGN §5.2「123/400」表示用）。 */
export function remainingSummaryChars(text: string, max: number = LEARNING_SUMMARY_MAX): number {
  return max - text.length;
}

/** 学びの要約が確定可能な状態か（空・401字以上はfalse。SPEC §5.1のAPIバリデーションとフロント側で同じ境界を使う）。 */
export function isSummaryValid(text: string, max: number = LEARNING_SUMMARY_MAX): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= max;
}

export type VisibilityChipLabel = "公開中" | "リンク限定";

/** セッション一覧・リプレイ画面のチップ文言（UI-DESIGN §5.2「非公開セッションには何も出さない」）。 */
export function visibilityChipLabel(visibility: string): VisibilityChipLabel | null {
  if (visibility === "public") return "公開中";
  if (visibility === "unlisted") return "リンク限定";
  return null;
}
