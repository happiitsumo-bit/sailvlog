import { visibilityChipLabel } from "@/lib/publish";

/** セッション一覧・リプレイ画面のヘッダに出す「公開中」/「リンク限定」チップ。
    非公開("team")セッションには何も出さない（UI-DESIGN §5.2）。 */
export function VisibilityChip({ visibility }: { visibility: string }) {
  const label = visibilityChipLabel(visibility);
  if (!label) return null;
  const variant = label === "公開中" ? "public" : "unlisted";
  return <span className={`visibility-chip visibility-chip--${variant}`}>{label}</span>;
}
