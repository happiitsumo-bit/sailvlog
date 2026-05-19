"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { getUser, clearAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_ITEMS, CLASS_ITEMS } from "@/config/navigation";

export default function ClassSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const user = getUser();
    setUsername(user?.username ?? null);
  }, []);

  function logout() {
    clearAuth();
    setUsername(null);
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="app-left-sidebar">
      {/* ナビリンク */}
      <div className="sidebar-nav-section">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-divider" />

      {/* 艇種リスト */}
      <div className="sidebar-nav-section">
        <div className="sidebar-nav-label">Classes</div>
        {CLASS_ITEMS.map((c) => {
          const active = pathname === `/boat/${c.slug}`;
          return (
            <Link
              key={c.slug}
              href={`/boat/${c.slug}`}
              className={`sidebar-class-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {c.flag ? (
                <Image
                  src={c.flag}
                  alt={`${c.label} class flag`}
                  width={28}
                  height={18}
                  className="sidebar-class-flag"
                  style={{ objectFit: "contain" }}
                />
              ) : (
                <span className="sidebar-class-flag-placeholder" aria-hidden="true" />
              )}
              <span>{c.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ユーザー情報 */}
      <div className="sidebar-user">
        {username ? (
          <>
            <div className="sidebar-user-avatar" aria-hidden="true">
              {username[0].toUpperCase()}
            </div>
            <span className="sidebar-user-name">@{username}</span>
            <button
              className="sidebar-logout-btn"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </>
        ) : (
          <Link href="/login" className="sidebar-nav-item" style={{ width: "100%" }}>
            <span className="sidebar-icon" aria-hidden="true">→</span>
            <span>Login</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
