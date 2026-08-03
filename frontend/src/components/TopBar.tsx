"use client";

import Link from "next/link";
import { getUser, clearAuth, subscribeAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const user = getUser();
    setUsername(user?.username ?? null);
    // Issue #26: TopBarはlayout.tsxにあり画面遷移で再マウントされないため、
    // ログイン(router.push)後に表示が更新されない。saveAuth/clearAuthの通知を購読する。
    return subscribeAuth((user) => setUsername(user?.username ?? null));
  }, []);

  function logout() {
    clearAuth();
    setUsername(null);
    router.push("/login");
    router.refresh();
  }

  // T-33: 公開ビュー `/p/[slug]` はログイン導線を強制しない認証不要ページ（UI-DESIGN §5.3）。
  // アプリ全体のTopBar（Login/Joinリンク）はここでは描画しない。
  if (pathname?.startsWith("/p/")) return null;

  return (
    <header className="app-topbar">
      <Link href="/sessions" className="topbar-logo">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
          <circle cx="10" cy="10" r="9" stroke="var(--color-accent)" strokeWidth="1.5" fill="none"/>
          <path d="M10 2 L12 10 L10 8 L8 10 Z" fill="var(--color-accent)"/>
          <path d="M10 18 L12 10 L10 12 L8 10 Z" fill="var(--fg-dim)"/>
        </svg>
        <span>sailvlog</span>
      </Link>

      <div className="topbar-actions">
        {username ? (
          <>
            {/* オーナー裁定（2026-08-02）: ログイン済みは`/`から`/sessions`へ自動リダイレクトされ
                自分のプロダクトの公開ホームを見られない副作用がある。当面はここに置くが、
                本来はSPEC-share2-team-pages.md §8.1のヘッダーメニュー「じぶんの」束に入る導線。
                そのメニュー実装時にこちらへ移す。 */}
            {/* m-13(Issue #43): 遷移先は特定セッションの公開ページではなく、未ログイン時に見える
                ランディング（公開ホーム）。旧ラベルは内容が読めなかったため改名した。 */}
            <Link href="/?preview=1" className="btn btn-ghost" style={{ fontSize: "0.85rem" }}>
              公開ホームを確認
            </Link>
            <span style={{ fontSize: "0.85rem", color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
              @{username}
            </span>
            <button className="btn btn-ghost" style={{ fontSize: "0.85rem" }} onClick={logout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="btn btn-ghost" style={{ fontSize: "0.85rem" }}>Login</Link>
            <Link href="/register" className="btn btn-primary" style={{ fontSize: "0.85rem" }}>Join</Link>
          </>
        )}
      </div>
    </header>
  );
}
