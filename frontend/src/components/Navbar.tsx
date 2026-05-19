"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUser, clearAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import ClassFlag from "./ClassFlag";

const NAV_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/questions", label: "Q&A" },
  { href: "/learn", label: "Learn" },
  { href: "/sailors", label: "Sailors" },
];

const CLASS_LINKS = [
  { slug: "470", label: "470" },
  { slug: "ilca", label: "ILCA" },
  { slug: "snipe", label: "Snipe" },
  { slug: "49er", label: "49er" },
  { slug: "420", label: "420" },
  { slug: "op", label: "OP" },
  { slug: "cruiser", label: "Cruiser" },
  { slug: "other", label: "Other" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const user = getUser();
    setUsername(user?.username ?? null);
  }, []);

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function logout() {
    clearAuth();
    setUsername(null);
    router.push("/");
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* ── Top row: brand + main nav + auth ── */}
        <div className="navbar-row navbar-row-top">
          <Link href="/" className="navbar-brand">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
              <circle cx="10" cy="10" r="9" stroke="var(--terra)" strokeWidth="1.5" fill="none"/>
              <path d="M10 2 L12 10 L10 8 L8 10 Z" fill="var(--terra)"/>
              <path d="M10 18 L12 10 L10 12 L8 10 Z" fill="var(--fg-dim)"/>
            </svg>
            sailvlog
          </Link>

          <div className="navbar-links">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={active ? "active" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="navbar-actions">
            {username ? (
              <>
                <Link href="/articles/new" className="btn btn-primary">
                  Write
                </Link>
                <Link href={`/users/${username}`}>@{username}</Link>
                <button onClick={logout} className="btn btn-ghost">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost">
                  Login
                </Link>
                <Link href="/register" className="btn btn-primary">
                  Join
                </Link>
              </>
            )}
          </div>

          {/* ── ハンバーガーボタン（モバイルのみ表示） ── */}
          <button
            className="navbar-hamburger"
            aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span className={`hamburger-bar ${menuOpen ? "open" : ""}`} />
            <span className={`hamburger-bar ${menuOpen ? "open" : ""}`} />
            <span className={`hamburger-bar ${menuOpen ? "open" : ""}`} />
          </button>
        </div>

        {/* ── モバイルメニュードロワー ── */}
        {menuOpen && (
          <div className="navbar-mobile-menu">
            <div className="navbar-mobile-links">
              {NAV_LINKS.map((link) => {
                const active =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`navbar-mobile-link ${active ? "active" : ""}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
            <div className="navbar-mobile-actions">
              {username ? (
                <>
                  <Link
                    href="/articles/new"
                    className="btn btn-primary"
                    onClick={() => setMenuOpen(false)}
                  >
                    Write
                  </Link>
                  <Link
                    href={`/users/${username}`}
                    className="btn btn-ghost"
                    onClick={() => setMenuOpen(false)}
                  >
                    @{username}
                  </Link>
                  <button onClick={logout} className="btn btn-ghost">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="btn btn-ghost"
                    onClick={() => setMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="btn btn-primary"
                    onClick={() => setMenuOpen(false)}
                  >
                    Join
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Bottom row: class flags ── */}
        <div className="navbar-row navbar-row-bottom">
          {CLASS_LINKS.map((c) => {
            const active = pathname === `/boat/${c.slug}`;
            return (
              <Link
                key={c.slug}
                href={`/boat/${c.slug}`}
                className={`navbar-class-link ${active ? "active" : ""}`}
                data-class={c.slug}
              >
                <ClassFlag slug={c.slug} />
                {c.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
