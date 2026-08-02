// SPEC-home-static.md §4.2 / §6 T-a: BottomTabBarの表示可否を純関数として抽出する。
// 抽出の目的は挙動を変えることではなく、既存の「/p/配下でナビを出さない」原則(T-33)を
// 自動テストで固定すること。あわせて公開ホーム`/`・ブログ`/blog`配下も
// マーケティング面として部内ナビ(Sessions等)を出さない対象に加える(SPEC §4.2-2)。
export function showBottomTabBar(pathname: string): boolean {
  // T-33: 公開ビューは部内ナビゲーションを出さない読み取り専用ページ(UI-DESIGN §5.3)。
  if (pathname.startsWith("/p/")) return false;
  // 公開ホーム: 未ログインの部外者に押した先が壊れる「⛵Sessions」タブを見せない。
  if (pathname === "/") return false;
  // ブログ(一覧・詳細): 公開ホームと同じくマーケティング面。
  if (pathname === "/blog" || pathname.startsWith("/blog/")) return false;
  return true;
}
