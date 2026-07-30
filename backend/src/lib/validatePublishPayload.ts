// T-30: POST /api/sessions/:id/publish の構造検証。
// ARCH.md §4 / SPEC-share1-phase1.md §5.1: visibility は "unlisted"|"public"、
// learningSummary は 1〜400字必須、publicAnnotationIds は数値配列（要素の所属チェックはルート側でDB参照して行う）。

export interface PublishPayloadInput {
  visibility?: unknown;
  learningSummary?: unknown;
  publicAnnotationIds?: unknown;
}

export type ValidationResult = { ok: true } | { ok: false; status: 400; error: string };

const MAX_SUMMARY_LEN = 400;
// m-04修正（2026-07-27, REVIEW-backend-2.md）: 配列長に上限が無く、巨大な配列を送ると
// sessions.tsのwhere: { id: { in: ids } } が巨大なIN(...)を発行し、Postgresのパラメータ上限で
// 例外(500)になり得た。上限値500の根拠: 1セッションの注釈は再生中に人力で打つ前提の数（実運用では
// 数十件程度）で、500件あれば通常利用を絶対に妨げない一方、8MBボディに詰め込める数十万件は
// 明確に弾ける値としてARCH.md §4の「サーバ側再検証」の精神に沿う。
const MAX_PUBLIC_ANNOTATION_IDS = 500;

export function validatePublishPayload(input: PublishPayloadInput): ValidationResult {
  const { visibility, learningSummary, publicAnnotationIds } = input;

  if (visibility !== "unlisted" && visibility !== "public") {
    return { ok: false, status: 400, error: "visibility は unlisted または public である必要があります" };
  }
  if (typeof learningSummary !== "string" || learningSummary.trim().length === 0) {
    return { ok: false, status: 400, error: "learningSummary は必須です" };
  }
  if (learningSummary.trim().length > MAX_SUMMARY_LEN) {
    return { ok: false, status: 400, error: `learningSummary は${MAX_SUMMARY_LEN}文字以内である必要があります` };
  }
  if (publicAnnotationIds !== undefined) {
    if (!Array.isArray(publicAnnotationIds)) {
      return { ok: false, status: 400, error: "publicAnnotationIds は配列である必要があります" };
    }
    if (publicAnnotationIds.length > MAX_PUBLIC_ANNOTATION_IDS) {
      return {
        ok: false,
        status: 400,
        error: `publicAnnotationIds は${MAX_PUBLIC_ANNOTATION_IDS}件以内である必要があります`,
      };
    }
    for (const id of publicAnnotationIds) {
      if (!Number.isInteger(id)) {
        return { ok: false, status: 400, error: "publicAnnotationIds の要素は整数である必要があります" };
      }
    }
  }

  return { ok: true };
}
