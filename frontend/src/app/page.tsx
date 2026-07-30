"use client";

// v3ピボット（2026-07-25, T-26）: v2のBentoホーム（記事/Q&A/チームランキング等）は
// アーカイブブランチ archive/v2-frontend へ退避の上で削除。ルートはログイン状態に応じて
// /sessions（一覧）または /login へ即座に振り分けるだけの入口にする。
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(isLoggedIn() ? "/sessions" : "/login");
  }, [router]);

  return null;
}
