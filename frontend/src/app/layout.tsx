import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/TopBar";
import ClassSidebar from "@/components/ClassSidebar";
import RightSidebar from "@/components/RightSidebar";
import BottomTabBar from "@/components/BottomTabBar";
import CommandPaletteProvider from "@/components/CommandPaletteProvider";
import CommandPalette from "@/components/CommandPalette";

export const metadata: Metadata = {
  title: "sailvlog — Knowledge that sails.",
  description: "A technical exchange platform for sailors. Q&A, articles, timeline, and learning courses for the sailing community.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <CommandPaletteProvider>
          <div className="app-shell">
            <TopBar />
            <ClassSidebar />
            <main className="app-main">
              {children}
            </main>
            <RightSidebar />
          </div>
          <BottomTabBar />
          <CommandPalette />
        </CommandPaletteProvider>
      </body>
    </html>
  );
}
