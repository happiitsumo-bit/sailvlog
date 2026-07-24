"use client";

import Link from "next/link";
import { getUser } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useCommandPalette } from "./CommandPaletteProvider";

export default function TopBar() {
  const [username, setUsername] = useState<string | null>(null);
  const { open } = useCommandPalette();

  useEffect(() => {
    const user = getUser();
    setUsername(user?.username ?? null);
  }, []);

  return (
    <header className="app-topbar">
      <Link href="/" className="topbar-logo">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
          <circle cx="10" cy="10" r="9" stroke="var(--terra)" strokeWidth="1.5" fill="none"/>
          <path d="M10 2 L12 10 L10 8 L8 10 Z" fill="var(--terra)"/>
          <path d="M10 18 L12 10 L10 12 L8 10 Z" fill="var(--fg-dim)"/>
        </svg>
        <span>sailvlog</span>
      </Link>

      <button
        className="topbar-search"
        onClick={open}
        aria-label="検索 (Ctrl+K)"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
      >
        <span className="topbar-search-icon">⌕</span>
        <span className="topbar-search-placeholder">
          記事・質問・セーラーを検索...
        </span>
        <kbd className="topbar-search-kbd">Ctrl K</kbd>
      </button>

      <div className="topbar-actions">
        {username ? (
          <>
            <Link href={`/users/${username}`} style={{ fontSize: "0.85rem", color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
              @{username}
            </Link>
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
