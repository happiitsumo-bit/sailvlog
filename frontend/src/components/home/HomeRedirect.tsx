"use client";

// SPEC-home-static.md §4.1 / HS-4: ログイン済みユーザーが `/` を開いたら `/sessions` へ
// 自動リダイレクトする（0タップ・毎朝の動線を最短にする裁定）。
// 描画は行わない小さな島。ホーム本体（page.tsx）はサーバコンポーネントのままで、
// ログイン判定（localStorage）だけをこのクライアントコンポーネントに閉じ込める。
//
// オーナー裁定（2026-08-02）: ログイン済みでも公開ホームを確認できる導線が必要
// （自分のプロダクトの公開面を見られない副作用の解消）。`?preview=1` が付いている
// 間はこのリダイレクトを抑止する。判定自体は `shouldRedirectToSessions`（lib/home.ts）
// に切り出し、DOM非依存のVitestで固定する。
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { HOME_PREVIEW_PARAM, shouldRedirectToSessions } from "@/lib/home";

export default function HomeRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewParam = searchParams.get(HOME_PREVIEW_PARAM);

  useEffect(() => {
    if (shouldRedirectToSessions(isLoggedIn(), previewParam)) {
      router.replace("/sessions");
    }
  }, [router, previewParam]);

  return null;
}
