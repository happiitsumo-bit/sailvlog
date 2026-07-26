"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/config/navigation";

export default function BottomTabBar() {
  const pathname = usePathname();
  // T-33: 公開ビュー `/p/[slug]` は部内ナビゲーション（Sessions/Handbookタブ）を出さない
  // 読み取り専用ページ（UI-DESIGN §5.3・編集系UI/内部導線は一切描画しない）。
  if (pathname?.startsWith("/p/")) return null;
  return (
    <nav className="bottom-tab-bar" aria-label="Main navigation">
      <div className="bottom-tab-bar-inner">
        {NAV_ITEMS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`bottom-tab-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="bottom-tab-icon" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
