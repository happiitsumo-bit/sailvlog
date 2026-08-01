// T-33/T-34: 公開ビュー `/p/[slug]`（UI-DESIGN §5.3・SPEC-share1-phase1.md §2.2・ADR-007）。
// 認証不要・読み取り専用。サーバーコンポーネントでデータ取得＋404判定＋OGPメタデータ出力を行い、
// 実際の再生UIはクライアントコンポーネント（PublicReplayView）に委譲する。
import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchPublicSession,
  isPublicSessionUnavailableError,
  PUBLIC_SESSION_RETRY_GUIDANCE,
  PUBLIC_SESSION_UNAVAILABLE_TITLE,
} from "@/lib/publicSession";
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
  let data;
  try {
    data = await fetchPublicSession(params.slug);
  } catch (error) {
    if (isPublicSessionUnavailableError(error)) {
      return { title: `${PUBLIC_SESSION_UNAVAILABLE_TITLE} — sailvlog` };
    }
    throw error;
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
  let data;
  try {
    data = await fetchPublicSession(params.slug);
  } catch (error) {
    if (!isPublicSessionUnavailableError(error)) throw error;
    return (
      <main className="container" style={{ maxWidth: 720 }}>
        <div className="empty-state" role="alert">
          <div className="empty-state-icon" aria-hidden>!</div>
          <h1 className="empty-state-text">{PUBLIC_SESSION_UNAVAILABLE_TITLE}</h1>
          <p style={{ color: "var(--fg-mute)", marginTop: "0.5rem" }}>
            {PUBLIC_SESSION_RETRY_GUIDANCE}
          </p>
          <Link
            href={`/p/${encodeURIComponent(params.slug)}`}
            className="btn btn-primary"
            style={{ marginTop: "1rem" }}
          >
            再読み込み
          </Link>
        </div>
      </main>
    );
  }

  return <PublicReplayView data={data} />;
}
