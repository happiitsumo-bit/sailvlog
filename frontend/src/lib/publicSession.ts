// T-33/T-34: `/p/[slug]` サーバーコンポーネント（page.tsx・generateMetadata）から
// `GET /api/public/sessions/:slug` を叩く共通ヘルパー。
//
// サーバー側フェッチはDockerネットワーク内の `API_URL`（backendコンテナ直通）を使う。
// クライアント側フェッチ(lib/api.ts)が使う `NEXT_PUBLIC_API_URL` はホスト側公開ポートで、
// フロントのサーバープロセスからは到達できない場合があるため区別する（docker-compose.yml参照）。
import { headers } from "next/headers";
import { PublicSessionResponse } from "@/types";

function serverApiUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

// Quality Gate Major1修正: このfetchはNext.jsのサーバーコンポーネントから実行されるため、
// backend視点ではリクエスト元IPが常に「Next.jsサーバー1台」になり、レート制限/閲覧数カウントが
// 実質1ユーザー分に潰れる（発見事項参照）。実際にブラウザからNextへ到達した際の
// x-forwarded-for（本番はVercelのエッジが設定する）を読み取り、backendへ専用ヘッダで転送する。
// 限界: backendのポートが直接到達可能な環境（今回のdocker-compose公開ポート等）では、
// このヘッダは呼び出し元が任意に詐称できてしまう（Next経由を強制するものではない）。
// 本番(Render)でも backend は公開URLを持つため同じ限界が残る。とはいえ「1台のIPに潰れて
// レート制限が機能しない」という実害（Major1本体）は解消できるため、詐称リスクは
// 発見事項に明記した上で許容する（ARCH.mdのS/M規模判断・0円構成の制約内での現実解）。
function forwardedClientIp(): string | null {
  const h = headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip");
}

/** 存在しない/非公開/取り消し済みはすべて null を返す（呼び出し側は一律404として扱う。ADR-007）。
    キャッシュは無効化する: 「公開をやめる」直後に同じURLが404へ切り替わる必要があるため（T-34検証項目）。 */
export async function fetchPublicSession(slug: string): Promise<PublicSessionResponse | null> {
  const clientIp = forwardedClientIp();
  const res = await fetch(`${serverApiUrl()}/api/public/sessions/${encodeURIComponent(slug)}`, {
    cache: "no-store",
    headers: clientIp ? { "x-forwarded-client-ip": clientIp } : undefined,
  });
  if (!res.ok) return null;
  return res.json();
}
