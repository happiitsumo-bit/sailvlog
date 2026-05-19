import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/TopBar";
import ClassSidebar from "@/components/ClassSidebar";
import BottomTabBar from "@/components/BottomTabBar";

export const metadata: Metadata = {
  title: "sailvlog — Knowledge that sails.",
  description: "A technical exchange platform for sailors. Q&A, articles, timeline, and learning courses for the sailing community.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <TopBar />
          <ClassSidebar />
          <main className="app-main">
            {children}
          </main>
        </div>
        <BottomTabBar />
      </body>
    </html>
  );
}
