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

export function validatePublishPayload(input: PublishPayloadInput): ValidationResult {
  const { visibility, learningSummary, publicAnnotationIds } = input;

  if (visibility !== "unlisted" && visibility !== "public") {
    return { ok: false, status: 400, error: "visibility は unlisted または public である必要があります" };
  }
  if (typeof learningSummary !== "string" || learningSummary.trim().length === 0) {
    return { ok: false, status: 400, error: "learningSummary は必須です" };
  }
  if (learningSummary.length > MAX_SUMMARY_LEN) {
    return { ok: false, status: 400, error: `learningSummary は${MAX_SUMMARY_LEN}文字以内である必要があります` };
  }
  if (publicAnnotationIds !== undefined) {
    if (!Array.isArray(publicAnnotationIds)) {
      return { ok: false, status: 400, error: "publicAnnotationIds は配列である必要があります" };
    }
    for (const id of publicAnnotationIds) {
      if (!Number.isInteger(id)) {
        return { ok: false, status: 400, error: "publicAnnotationIds の要素は整数である必要があります" };
      }
    }
  }

  return { ok: true };
}
