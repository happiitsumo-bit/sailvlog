// T-32: 公開昇格ダイアログ・チップまわりの純関数（SPEC-share1-phase1.md §3.1 F-1〜F-3, UI-DESIGN §5.2）。
// T-29/M4-03: R-05（公開中セッションへの変更確認）の判定純関数もここに集約する。
// DOM/APIに依存しないためユニットテスト対象（t32-publish.test.ts, t29-session-warnings.test.ts）。

import { Annotation, SessionDetail } from "@/types";

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

/** セッションが公開中（visibility !== "team"）か。detail未取得（null）はfalse。
    R-05: 公開中セッションへの変更（航跡追加・公開注釈の編集）は警告＋明示確認の対象になる。 */
export function sessionIsPublished(detail: SessionDetail | null): boolean {
  return detail !== null && detail.session.visibility !== "team";
}

/** 航跡追加の前に「公開中です」の警告を挟むべきか（R-05）。 */
export function shouldWarnBeforeTrackAdd(detail: SessionDetail | null): boolean {
  return sessionIsPublished(detail);
}

// Issue #36 (C-01): 公開ダイアログでの艇ラベル確認・編集。GPX取込時の既定値はファイル名
// （例: "boat1_clean"）で、未編集のまま公開すると意味の無い表記が出る（実名露出そのものではないが、
// 「編集していない＝内容を確認していない」ことの代理指標として使う）。
const FILENAME_LIKE_LABEL_RE = /^[A-Za-z0-9_-]+$/;

/** ラベルが「ファイル名そのまま（未編集）」に見えるか。半角英数字・アンダースコア・ハイフンのみ
    （日本語や空白を含まない）場合をヒューリスティックにそう判定する。 */
export function looksLikeUneditedBoatLabel(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length === 0) return false;
  return FILENAME_LIKE_LABEL_RE.test(trimmed);
}

/** 注釈編集の前に警告を挟むべきか（R-05）。
    新規注釈の作成には出さず、既に公開済み（isPublic===true）の注釈の編集にのみ出す
    （REVIEW-4.md良い点2: 全ミューテーションに出すと「警告疲れ」で誰も読まなくなる）。 */
export function shouldWarnBeforeAnnotationEdit(
  detail: SessionDetail | null,
  annotation: Pick<Annotation, "isPublic">
): boolean {
  return sessionIsPublished(detail) && annotation.isPublic;
}
