// 元はT-31: GET /api/public/sessions/:slug 専用として作った簡易レート制限だったが、
// M-04修正（2026-07-27, REVIEW-backend-2.md）でPOST /api/auth/loginにも同種の仕組みが
// 必要になったため、固定ウィンドウ・カウンタの生成ロジックを汎用ヘルパーに切り出した
// （「T-31: 公開API用」というコメントは実態と食い違うため更新）。
// 新規npm依存を足さず、Expressのメモリ内カウンタで実装（Renderの単一インスタンス前提で十分）。
// 固定ウィンドウ方式: キーごとに直近windowMs間のリクエスト数を数え、上限を超えたらfalseを返す。

interface Bucket {
  windowStart: number;
  count: number;
}

function createFixedWindowLimiter(windowMs: number, limit: number) {
  const buckets = new Map<string, Bucket>();
  return {
    check(key: string, now: number = Date.now()): boolean {
      const existing = buckets.get(key);
      if (!existing || now - existing.windowStart >= windowMs) {
        buckets.set(key, { windowStart: now, count: 1 });
        return true;
      }
      existing.count += 1;
      return existing.count <= limit;
    },
    reset(): void {
      buckets.clear();
    },
  };
}

// GET /api/public/sessions/:slug 用（IP単位・60秒60回）。既存の挙動・エクスポート名は変えない。
const publicViewLimiter = createFixedWindowLimiter(60 * 1000, 60);

/** 呼び出し元IPが直近60秒でLIMIT回を超えていなければtrue（カウントを1つ進める）。超えていればfalse。 */
export function checkRateLimit(ip: string, now: number = Date.now()): boolean {
  return publicViewLimiter.check(ip, now);
}

/** テスト専用: バケット状態をリセットする(テスト間の汚染防止)。本番コードからは呼ばない。 */
export function _resetRateLimiterForTests(): void {
  publicViewLimiter.reset();
}

// M-04: POST /api/auth/login 用（IP単位・60秒10回）。
// 根拠: bcrypt cost 12の比較は1回数百ms・Nodeのスレッドプール(既定4)を専有するため、
// 正当なユーザーの試行回数（パスワードミス含め数回）を大きく上回りつつ、
// 総当たり攻撃のコストを実質的に上げる値としてIP単位60秒10回を採用した
// （公開ビュー用の60回/60秒より厳しくしている。認証・書き込み系は公開GETより
// コストが高いため、というREVIEW-backend-2.md M-04の指摘に基づく）。
const authLimiter = createFixedWindowLimiter(60 * 1000, 10);

/** 呼び出し元IPが直近60秒で10回を超えていなければtrue（カウントを1つ進める）。超えていればfalse。 */
export function checkAuthRateLimit(ip: string, now: number = Date.now()): boolean {
  return authLimiter.check(ip, now);
}

/** テスト専用: 認証用バケット状態をリセットする。本番コードからは呼ばない。 */
export function _resetAuthRateLimiterForTests(): void {
  authLimiter.reset();
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
