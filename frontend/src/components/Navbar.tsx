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
  { slug: "cruiser", label: "Cruiser" },
  { slug: "other", label: "Other" },
];

export default function Navbar() {
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
    router.push("/");
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* ── Top row: brand + main nav + auth ── */}
        <div className="navbar-row navbar-row-top">
          <Link href="/" className="navbar-brand">
            <span className="dot" />sailvlog
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
        </div>

        {/* ── Bottom row: class flags ── */}
        <div className="navbar-row navbar-row-bottom">
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '.82rem', color: 'var(--fg-mute)', paddingRight: '.75rem', borderRight: '1px solid var(--border)', fontWeight: 500, flexShrink: 0 }}>Class</span>
          {CLASS_LINKS.map((c) => {
            const active = pathname === `/boat/${c.slug}`;
            return (
              <Link
                key={c.slug}
                href={`/boat/${c.slug}`}
                className={`navbar-class-link ${active ? "active" : ""}`}
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
