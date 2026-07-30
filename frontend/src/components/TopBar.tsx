"use client";

import Link from "next/link";
import { getUser, clearAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const user = getUser();
    setUsername(user?.username ?? null);
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
