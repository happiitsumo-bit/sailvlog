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

// m-02修正（2026-07-27, REVIEW-backend-2.md）: buckets/lastViewedAtに破棄処理が無く、
// プロセスが生きている限りキー（IP、IP:slug）が単調増加していた。
// 新しい setInterval は増やさない方針にした。理由: ①windowMsが60秒/300秒と短く、
// アクセスのたびに「期限切れなら全体を軽く掃除する」だけで十分に増加を抑えられる
// （タイマーを増やすと「タイマーが積み上がってプロセスがexitしにくくなる」という
// 別の懸念を増やすだけで得るものが無い）。②アクセス頻度がゼロならメモリが増える心配自体が
// 発生しない（誰も呼ばないRoute=誰もキーを増やさない）ので、遅延掃除で足りる。
// 掃除コストを毎回払わないよう、確率的に間引いて実行する（SWEEP_PROBABILITY）。
const SWEEP_PROBABILITY = 0.01; // 期待値としてアクセス100回に1回、Map全体を掃除する

function createFixedWindowLimiter(windowMs: number, limit: number) {
  const buckets = new Map<string, Bucket>();
  function sweepExpired(now: number): void {
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStart >= windowMs) {
        buckets.delete(key);
      }
    }
  }
  return {
    check(key: string, now: number = Date.now()): boolean {
      if (Math.random() < SWEEP_PROBABILITY) {
        sweepExpired(now);
      }
      const existing = buckets.get(key);
      if (!existing || now - existing.windowStart >= windowMs) {
        buckets.set(key, { windowStart: now, count: 1 });
        return true;
      }
      existing.count += 1;
      return existing.count <= limit;
    },
    // B3-01修正（2026-07-28, REVIEW-backend-3.md）: 「判定だけして消費しない」版。
    // ログイン成功時にカウントを消費しないため、判定(peek)と消費(recordFailure)を分離する。
    peek(key: string, now: number = Date.now()): boolean {
      if (Math.random() < SWEEP_PROBABILITY) {
        sweepExpired(now);
      }
      const existing = buckets.get(key);
      if (!existing || now - existing.windowStart >= windowMs) {
        return true;
      }
      return existing.count < limit;
    },
    record(key: string, now: number = Date.now()): void {
      const existing = buckets.get(key);
      if (!existing || now - existing.windowStart >= windowMs) {
        buckets.set(key, { windowStart: now, count: 1 });
        return;
      }
      existing.count += 1;
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

// B3-01修正（2026-07-28, REVIEW-backend-3.md）: M-04で入れたIP単位10回/60秒は、
// ①Render経由だとtrust proxy未設定でreq.ipが内部プロキシの1つのIPに潰れる
// ②仮に①を直しても、部室の共有Wi-Fi/大学NATは反省会当日「全員が同一グローバルIP」になる、
// という2段階の理由で「部室に集まって全員ログインする」という本製品の唯一の利用シーンと
// 正面から衝突していた（public.tsが既に同じ罠を踏んで解決済みだった教訓を適用できていなかった）。
//
// 総当たり防止の本質は「1アカウントへの試行回数」であり、共有IP配下の正常ログインを
// 巻き込む理由がない。よってキーをIPからemail中心に変える:
//   - emailLimiter: 同一emailへの連続試行を10回/60秒に制限する（総当たり対策の本体）。
//     ログイン成功はカウントを消費しない（peek/recordを分離し、失敗時のみrecordする）。
//   - ipLimiter: IP単位は「DoSの蓋」としてのみ機能する緩い上限に変更（60回/60秒）。
//     部室の共有IPで20人が一斉ログインしても踏まない値。email側と違い成功/失敗を問わず
//     全試行を消費する単純なcheck()のままでよい（悪意ある大量リクエストの頭打ちが目的のため）。
const authEmailLimiter = createFixedWindowLimiter(60 * 1000, 10);
const authIpLimiter = createFixedWindowLimiter(60 * 1000, 60);

/** email単位の判定のみ（消費しない）。直近60秒で10回未満ならtrue。 */
export function peekAuthEmailRateLimit(email: string, now: number = Date.now()): boolean {
  return authEmailLimiter.peek(email, now);
}

/** email単位の失敗を1回記録する（ログイン失敗時のみ呼ぶ。成功時は呼ばない）。 */
export function recordAuthEmailFailure(email: string, now: number = Date.now()): void {
  authEmailLimiter.record(email, now);
}

/** IP単位のDoS蓋（60秒60回）。呼び出すたびに1回消費する。 */
export function checkAuthIpRateLimit(ip: string, now: number = Date.now()): boolean {
  return authIpLimiter.check(ip, now);
}

/** テスト専用: 認証用バケット状態(email/IP双方)をリセットする。本番コードからは呼ばない。 */
export function _resetAuthRateLimiterForTests(): void {
  authEmailLimiter.reset();
  authIpLimiter.reset();
}

// M3-02修正（2026-07-28, REVIEW-backend-3.md）: registerにはレート制限が無く、bcrypt.hash(cost 12)
// （compareより重い）を毎秒20回叩けばlibuvスレッドプール(既定4)が飽和し、反省会中に公開ページも
// 巻き込まれて固まりうる、という指摘。registerには「既存アカウント」の概念が無く成功/失敗の区別が
// 意味を持たないため、loginのようなemail単位の判定/消費分離は不要で、IP単位の単純な固定ウィンドウ
// でDoSの蓋をかければ足りる（この点はlogin側より単純）。上限は100/60秒とした。
// 「毎秒20回」という脅威に対しては100/60秒(≒1.7回/秒)でも桁違いに絞れており脅威は解消するが、
// backendの結合テストは`createSessionAsMember`等のヘルパー経由で1ファイルあたり最大31回程度
// registerを叩く（t12-sessions-api.test.ts実測）ため、20/60秒のような値だとテストスイート自体が
// 誤って弾かれる（実測して確認済み）。将来テストが増える余地を見て100とした。
const registerIpLimiter = createFixedWindowLimiter(60 * 1000, 100);

/** IP単位の登録レート制限。直近60秒で100回を超えていなければtrue（呼ぶたびに1回消費する）。 */
export function checkRegisterRateLimit(ip: string, now: number = Date.now()): boolean {
  return registerIpLimiter.check(ip, now);
}

/** テスト専用: register用バケット状態をリセットする。本番コードからは呼ばない。 */
export function _resetRegisterRateLimiterForTests(): void {
  registerIpLimiter.reset();
}

// T-31: publicViewCount加算の間引き（同一IP・同一スラッグは5分に1回まで。SPEC §5.4）。
const VIEW_THROTTLE_MS = 5 * 60 * 1000;
const lastViewedAt = new Map<string, number>();

/** このIP・スラッグの組み合わせで直近5分以内に加算済みならfalse（加算しない）。未加算ならtrueを返し記録する。 */
export function shouldCountView(ip: string, slug: string, now: number = Date.now()): boolean {
  // m-02: こちらも同じ確率的遅延掃除で破棄する（新規setInterval無し。上記と同じ理由）。
  if (Math.random() < SWEEP_PROBABILITY) {
    for (const [k, lastAt] of lastViewedAt) {
      if (now - lastAt >= VIEW_THROTTLE_MS) {
        lastViewedAt.delete(k);
      }
    }
  }
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
