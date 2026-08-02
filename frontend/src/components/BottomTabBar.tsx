"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/config/navigation";
import { showBottomTabBar } from "@/lib/navVisibility";

export default function BottomTabBar() {
  const pathname = usePathname();
  // T-33 / SPEC-home-static.md §4.2: 表示可否は navVisibility.ts の純関数に委譲し、
  // 「/p/配下でナビを出さない」原則を自動テスト（T-a）で固定する。
  if (!showBottomTabBar(pathname ?? "")) return null;
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
