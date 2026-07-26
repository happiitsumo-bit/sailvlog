// T-33/T-34: `/p/[slug]` サーバーコンポーネント（page.tsx・generateMetadata）から
// `GET /api/public/sessions/:slug` を叩く共通ヘルパー。
//
// サーバー側フェッチはDockerネットワーク内の `API_URL`（backendコンテナ直通）を使う。
// クライアント側フェッチ(lib/api.ts)が使う `NEXT_PUBLIC_API_URL` はホスト側公開ポートで、
// フロントのサーバープロセスからは到達できない場合があるため区別する（docker-compose.yml参照）。
import { PublicSessionResponse } from "@/types";

function serverApiUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

/** 存在しない/非公開/取り消し済みはすべて null を返す（呼び出し側は一律404として扱う。ADR-007）。
    キャッシュは無効化する: 「公開をやめる」直後に同じURLが404へ切り替わる必要があるため（T-34検証項目）。 */
export async function fetchPublicSession(slug: string): Promise<PublicSessionResponse | null> {
  const res = await fetch(`${serverApiUrl()}/api/public/sessions/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}
