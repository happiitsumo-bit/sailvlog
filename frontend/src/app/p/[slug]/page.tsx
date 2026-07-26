// T-33: 公開ビュー `/p/[slug]`（UI-DESIGN §5.3・SPEC-share1-phase1.md §2.2・ADR-007）。
// 認証不要・読み取り専用。サーバーコンポーネントでデータ取得＋404判定を行い、
// 実際の再生UIはクライアントコンポーネント（PublicReplayView）に委譲する。
import { notFound } from "next/navigation";
import { fetchPublicSession } from "@/lib/publicSession";
import { PublicReplayView } from "./PublicReplayView";

interface PageProps {
  params: { slug: string };
}

export default async function PublicSessionPage({ params }: PageProps) {
  const data = await fetchPublicSession(params.slug);
  // 存在しない/非公開/取り消し済みを区別しない一律404（UI-DESIGN §5.3・T-31と同じ思想をフロントにも適用）。
  if (!data) notFound();

  return <PublicReplayView data={data} />;
}
