import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "sailvlog — Knowledge that sails.",
  description: "セーラーのための技術交流プラットフォーム。Q&A・記事・タイムライン・学習コースが集約されたコミュニティ。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
