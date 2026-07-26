// T-33/T-34: 公開ビュー `/p/[slug]`（UI-DESIGN §5.3・SPEC-share1-phase1.md §2.2・ADR-007）。
// 認証不要・読み取り専用。サーバーコンポーネントでデータ取得＋404判定＋OGPメタデータ出力を行い、
// 実際の再生UIはクライアントコンポーネント（PublicReplayView）に委譲する。
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublicSession } from "@/lib/publicSession";
import { PublicReplayView } from "./PublicReplayView";

interface PageProps {
  params: { slug: string };
}

const LEARNING_SUMMARY_DESCRIPTION_LEN = 100;
// 静的OG画像1枚（海図面＋ロゴ）。SPEC §3.2どおり動的OG画像生成はバックログのため作らない。
const OG_IMAGE_PATH = "/og-image.png";

// og:image等の絶対URL組み立て用。next/metadataの`metadataBase`は開発用Dockerの内部ポート(next devの3000)
// と公開ポート(docker-compose上は3001)がズレる構成でうまく解決されない実測不具合があったため
// （発見事項参照）、backendのpublicOrigin()と同じ発想でここも明示的に組み立てる。
function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

// T-34: title・description(学びの要約冒頭100字)・og:image(静的1枚)・unlistedはnoindex。
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await fetchPublicSession(params.slug);
  if (!data) {
    // 404ページ自体にOGPは不要（一律404の思想どおり、存在有無を示唆する情報を追加で出さない）。
    return { title: "セッションが見つかりません — sailvlog" };
  }

  const { session } = data;
  const title = `${session.title} ｜ ${session.team.name} — sailvlog`;
  const description = (session.learningSummary ?? "").slice(0, LEARNING_SUMMARY_DESCRIPTION_LEN);
  const ogImageUrl = `${siteOrigin()}${OG_IMAGE_PATH}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImageUrl],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    // unlisted（リンクを知っている人だけ）は検索避け。publicは制限しない（UI-DESIGN §5.3）。
    robots: session.visibility === "unlisted" ? { index: false, follow: false } : undefined,
  };
}

export default async function PublicSessionPage({ params }: PageProps) {
  const data = await fetchPublicSession(params.slug);
  // 存在しない/非公開/取り消し済みを区別しない一律404（UI-DESIGN §5.3・T-31と同じ思想をフロントにも適用）。
  if (!data) notFound();

  return <PublicReplayView data={data} />;
}
