import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/TopBar";
import BottomTabBar from "@/components/BottomTabBar";

export const metadata: Metadata = {
  title: "sailvlog — 反省会リプレイ・デバッガ",
  description: "大学ヨット部の反省会のための、複数艇GPX航跡リプレイ・注釈共有ツール。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="app-shell app-shell--v3">
          <TopBar />
          <main className="app-main app-main--v3">
            {children}
          </main>
        </div>
        <BottomTabBar />
      </body>
    </html>
  );
}
