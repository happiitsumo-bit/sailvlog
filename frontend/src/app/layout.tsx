import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/TopBar";
import BottomTabBar from "@/components/BottomTabBar";

export const metadata: Metadata = {
  // T-34: /p/[slug] の generateMetadata が相対パス("/og-image.png"等)を絶対URLへ解決するために必要。
  // 未設定env時はdocker-composeのフロント公開ポート(3001)にフォールバック。
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"),
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
