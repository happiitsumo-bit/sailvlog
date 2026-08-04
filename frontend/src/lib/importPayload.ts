/**
 * 取込リクエストのサイズ判定（Issue #40 のレビュー指摘への対応）。
 *
 * セッション作成と全艇のトラック投入を1リクエストに統合したことで、
 * 従来「艇ごとに上限まで」だったものが「全艇合計で上限まで」に変わった。
 * 上限を超えると express は本文をパースする前に 413 を返すため、
 * アプリ側のエラー処理は一切通らず「保存に失敗しました」としか表示できない。
 * 送る前にこちらで判定して、原因と対処を言えるようにする。
 *
 * 上限値は backend/src/index.ts の `express.json({ limit })` と揃えること。
 * ここを変えるときは向こうも変える（片方だけ動かすと、通るはずのものを弾くか、
 * 弾けずに 413 に落ちるかのどちらかになる）。
 */

/** backend/src/index.ts の /api/sessions の limit と同じ値 */
export const SESSION_BODY_LIMIT_BYTES = 24 * 1024 * 1024;

/**
 * サーバ側の判定はエンコード後のバイト数なので、こちらも同じ基準で測る。
 * 余裕（ヘッダ等）を見て上限の95%を実効上限とする。
 */
const EFFECTIVE_RATIO = 0.95;

export function measurePayloadBytes(payload: unknown): number {
  return new TextEncoder().encode(JSON.stringify(payload)).length;
}

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/**
 * 大きすぎる場合はユーザー向けのメッセージを返す。問題なければ null。
 *
 * @param trackCount 艇数。未指定なら payload.tracks の長さを使う
 */
export function describeOversizedPayload(
  payload: { tracks?: unknown[] } | unknown,
  limitBytes: number = SESSION_BODY_LIMIT_BYTES
): string | null {
  const bytes = measurePayloadBytes(payload);
  const effectiveLimit = Math.floor(limitBytes * EFFECTIVE_RATIO);
  if (bytes <= effectiveLimit) return null;

  const tracks = (payload as { tracks?: unknown[] })?.tracks;
  const count = Array.isArray(tracks) ? tracks.length : 0;

  const perBoat = count > 0 ? `（1艇あたり約${formatMB(bytes / count)}MB）` : "";
  const suffix =
    count > 1
      ? `艇を分けて複数のセッションに取り込むか、記録時間の短いGPXを使ってください。`
      : `記録時間の短いGPXを使ってください。`;

  return `取込データが大きすぎます: ${count}艇で合計約${formatMB(bytes)}MB${perBoat}。上限は約${formatMB(
    effectiveLimit
  )}MBです。${suffix}`;
}
