// T-31: GET /api/public/sessions/:slug 用の簡易レート制限（ARCH.md §4・SPEC-share1-phase1.md §5.4）。
// 新規npm依存を足さず、Expressのメモリ内カウンタで実装（Renderの単一インスタンス前提で十分）。
// 固定ウィンドウ方式: IPごとに直近60秒間のリクエスト数を数え、上限を超えたらfalseを返す。

const WINDOW_MS = 60 * 1000;
const LIMIT = 60;

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

/** 呼び出し元IPが直近60秒でLIMIT回を超えていなければtrue（カウントを1つ進める）。超えていればfalse。 */
export function checkRateLimit(ip: string, now: number = Date.now()): boolean {
  const existing = buckets.get(ip);
  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    buckets.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  existing.count += 1;
  return existing.count <= LIMIT;
}

/** テスト専用: バケット状態をリセットする(テスト間の汚染防止)。本番コードからは呼ばない。 */
export function _resetRateLimiterForTests(): void {
  buckets.clear();
}

// T-31: publicViewCount加算の間引き（同一IP・同一スラッグは5分に1回まで。SPEC §5.4）。
const VIEW_THROTTLE_MS = 5 * 60 * 1000;
const lastViewedAt = new Map<string, number>();

/** このIP・スラッグの組み合わせで直近5分以内に加算済みならfalse（加算しない）。未加算ならtrueを返し記録する。 */
export function shouldCountView(ip: string, slug: string, now: number = Date.now()): boolean {
  const key = `${ip}:${slug}`;
  const last = lastViewedAt.get(key);
  if (last !== undefined && now - last < VIEW_THROTTLE_MS) {
    return false;
  }
  lastViewedAt.set(key, now);
  return true;
}

/** テスト専用: viewCount間引き状態をリセットする。本番コードからは呼ばない。 */
export function _resetViewThrottleForTests(): void {
  lastViewedAt.clear();
}
