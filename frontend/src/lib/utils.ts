const AVATAR_COLORS = ["#ff3d00", "#00d9ff", "#c4ff00", "#C96442", "#6B8E5A", "#C39A3F"];

export function getAvatarColor(username: string): string {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

/** セッション内相対秒 → "HH:MM:SS"（リプレイ画面・公開ビュー・昇格ダイアログで共通利用。ADR-007の
    「再生エンジンをそのまま再利用する」思想を時刻表示の細部にも適用し、表記の分岐を作らない）。 */
export function formatClockTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("ja-JP");
}
