"use client";

// SPEC-home-static.md §4.1 / HS-4: ログイン済みユーザーが `/` を開いたら `/sessions` へ
// 自動リダイレクトする（0タップ・毎朝の動線を最短にする裁定）。
// 描画は行わない小さな島。ホーム本体（page.tsx）はサーバコンポーネントのままで、
// ログイン判定（localStorage）だけをこのクライアントコンポーネントに閉じ込める。
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

export default function HomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/sessions");
    }
  }, [router]);

  return null;
}
