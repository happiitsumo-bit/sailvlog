// M-4(Issue #42): 未ログインで深いリンク（例: /sessions/2）を開くと、ログイン後に
// 元のページへ戻れず/sessionsの空状態に着地していた問題への対応。
// 「反省会前にURLをLINEで共有する」運用（/handbook推奨）と正面衝突するため、
// ?next=で復帰先を運び、ログイン後にそこへ戻す。
//
// next はオープンリダイレクトにならないよう、自サイト内の相対パスのみ許可する
// （"//evil.com" のようなプロトコル相対URL・"https://evil.com" のような絶対URLは拒否）。

/** 与えられたパス+検索文字列から /login?next=... のURLを組み立てる。 */
export function buildLoginRedirectUrl(pathname: string, search: string = ""): string {
  const next = `${pathname}${search}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

/** next パラメータが自サイト内の相対パスとして安全か（オープンリダイレクト対策）。
    "/" 単体、または "/" 単体で始まり "//" では始まらないものだけを許可する。 */
export function isSafeNextPath(next: string | null | undefined): next is string {
  if (!next) return false;
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  // "/\evil.com" のようにブラウザがバックスラッシュをスラッシュ扱いする経路も塞ぐ
  if (next.startsWith("/\\")) return false;
  return true;
}

/** ログイン後の遷移先。安全なnextがあればそれを、無ければ既定の/sessionsを返す。 */
export function resolveLoginDestination(next: string | null | undefined): string {
  return isSafeNextPath(next) ? next : "/sessions";
}
