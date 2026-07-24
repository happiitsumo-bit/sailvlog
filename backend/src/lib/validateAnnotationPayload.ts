// ARCH.md §4「サーバ側再検証」: 注釈(Annotation)のPOST/PATCH共通の構造検証。
// tSec∈[0,durationSec]・body≦2000字。trackId/legIndexの存在整合はルート側(DB参照)で見る。

export interface AnnotationPayloadInput {
  tSec?: unknown;
  body?: unknown;
  trackId?: unknown;
  legIndex?: unknown;
}

export type ValidationResult = { ok: true } | { ok: false; status: 400; error: string };

const MAX_BODY_LEN = 2000;

export function validateAnnotationPayload(
  input: AnnotationPayloadInput,
  durationSec: number
): ValidationResult {
  const { tSec, body, trackId, legIndex } = input;

  if (!Number.isInteger(tSec) || (tSec as number) < 0 || (tSec as number) > durationSec) {
    return { ok: false, status: 400, error: `tSec は0〜${durationSec}の整数である必要があります` };
  }
  if (typeof body !== "string" || body.trim().length === 0) {
    return { ok: false, status: 400, error: "body は必須です" };
  }
  if (body.length > MAX_BODY_LEN) {
    return { ok: false, status: 400, error: `body は${MAX_BODY_LEN}文字以内である必要があります` };
  }
  if (trackId !== undefined && trackId !== null && !Number.isInteger(trackId)) {
    return { ok: false, status: 400, error: "trackId は整数である必要があります" };
  }
  if (legIndex !== undefined && legIndex !== null && (!Number.isInteger(legIndex) || (legIndex as number) < 0)) {
    return { ok: false, status: 400, error: "legIndex は0以上の整数である必要があります" };
  }

  return { ok: true };
}
