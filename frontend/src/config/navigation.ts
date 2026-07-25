// v3ピボット（2026-07-25, T-26）: v2画面（articles/questions/feed/learn/reference/boat/tag/teams/sailors/users）は
// アーカイブブランチ archive/v2-frontend へ退避の上でフロントから削除。ナビはv3の実態（セッション/収録ハンドブック）のみに絞る。
export const NAV_ITEMS = [
  { href: "/sessions", icon: "⛵", label: "Sessions" },
  { href: "/handbook", icon: "📘", label: "Handbook" },
] as const;
