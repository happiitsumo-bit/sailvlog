// T-33/T-34: `/p/[slug]` サーバーコンポーネント（page.tsx・generateMetadata）から
// `GET /api/public/sessions/:slug` を叩く共通ヘルパー。
//
// サーバー側フェッチはDockerネットワーク内の `API_URL`（backendコンテナ直通）を使う。
// クライアント側フェッチ(lib/api.ts)が使う `NEXT_PUBLIC_API_URL` はホスト側公開ポートで、
// フロントのサーバープロセスからは到達できない場合があるため区別する（docker-compose.yml参照）。
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicSessionResponse } from "@/types";

export const PUBLIC_SESSION_UNAVAILABLE_TITLE = "一時的に表示できません";
export const PUBLIC_SESSION_RETRY_GUIDANCE =
  "時間をおいてから、もう一度お試しください。";

export class PublicSessionUnavailableError extends Error {
  readonly name = "PublicSessionUnavailableError";

  constructor(
    readonly status: number | null,
    options?: ErrorOptions
  ) {
    super(PUBLIC_SESSION_UNAVAILABLE_TITLE, options);
  }
}

export function isPublicSessionUnavailableError(
  error: unknown
): error is PublicSessionUnavailableError {
  return (
    error instanceof PublicSessionUnavailableError ||
    (error instanceof Error && error.name === "PublicSessionUnavailableError")
  );
}

/** 404だけを存在秘匿用ページへ送り、それ以外のHTTP失敗は一時障害として扱う。 */
export function handlePublicSessionErrorStatus(
  status: number,
  renderNotFound: () => never = notFound
): never {
  if (status === 404) renderNotFound();
  throw new PublicSessionUnavailableError(status);
}

/** fetch自体が応答を得られなかった場合も、存在しない扱いにはしない。 */
export function publicSessionNetworkError(cause: unknown): PublicSessionUnavailableError {
  return new PublicSessionUnavailableError(null, { cause });
}

function serverApiUrl(): string {
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

// Quality Gate Major1修正: このfetchはNext.jsのサーバーコンポーネントから実行されるため、
// backend視点ではリクエスト元IPが常に「Next.jsサーバー1台」になり、レート制限/閲覧数カウントが
// 実質1ユーザー分に潰れる（発見事項参照）。実際にブラウザからNextへ到達した際の
// x-forwarded-for（本番はVercelのエッジが設定する）を読み取り、backendへ専用ヘッダで転送する。
// x-forwarded-client-ip は、サーバー専用環境変数 INTERNAL_PROXY_SECRET と同じ値を
// x-internal-proxy-secret に積んだ場合だけbackendが信用する（ADR-010）。
function forwardedClientIp(): string | null {
  const h = headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip");
}

/** 存在しない/非公開/取り消し済みはすべて一律404として扱う（ADR-007）。
    429・5xx・ネットワーク例外は PublicSessionUnavailableError として呼び出し側へ伝える。
    キャッシュは無効化する: 「公開をやめる」直後に同じURLが404へ切り替わる必要があるため（T-34検証項目）。 */
export async function fetchPublicSession(slug: string): Promise<PublicSessionResponse> {
  const clientIp = forwardedClientIp();
  const proxySecret = process.env.INTERNAL_PROXY_SECRET;
  const requestHeaders: Record<string, string> = {};
  if (clientIp) requestHeaders["x-forwarded-client-ip"] = clientIp;
  if (proxySecret) requestHeaders["x-internal-proxy-secret"] = proxySecret;

  let res: Response;
  try {
    res = await fetch(`${serverApiUrl()}/api/public/sessions/${encodeURIComponent(slug)}`, {
      cache: "no-store",
      headers: requestHeaders,
    });
  } catch (error) {
    throw publicSessionNetworkError(error);
  }

  if (!res.ok) handlePublicSessionErrorStatus(res.status);
  return res.json();
}
