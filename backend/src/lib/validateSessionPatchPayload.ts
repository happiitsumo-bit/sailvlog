// M-06修正（2026-07-27, REVIEW-backend-2.md）: ARCH.md §4「サーバ側再検証（フロントパースを
// 信頼しない）」はTrack/Annotationには実装済みだったが、PATCH /api/sessions/:id の
// notes/marks/legs は無検証で素通しされていた。しかもlegsは共有1でserializePublicSession.ts
// 経由で公開ページに出るデータへ昇格しており、扱いの格が上がっているのに検証が追いついて
// いなかった（不正な形のlegsを保存すると公開ページ側で`legs.map is not a function`のように
// 壊れる恐れがある）。既存2つのバリデータ(validateTrackPayload/validateAnnotationPayload)と
// 同じ形（{ok:true} | {ok:false,status,error}）で揃える。

export interface SessionPatchPayloadInput {
  notes?: unknown;
  marks?: unknown;
  legs?: unknown;
}

export type ValidationResult = { ok: true } | { ok: false; status: 400; error: string };

const MAX_NOTES_LEN = 4000;
const MAX_MARKS = 50;
const MAX_LEGS = 50;

export function validateSessionPatchPayload(input: SessionPatchPayloadInput): ValidationResult {
  const { notes, marks, legs } = input;

  if (notes !== undefined && notes !== null) {
    if (typeof notes !== "string") {
      return { ok: false, status: 400, error: "notes は文字列である必要があります" };
    }
    if (notes.length > MAX_NOTES_LEN) {
      return { ok: false, status: 400, error: `notes は${MAX_NOTES_LEN}文字以内である必要があります` };
    }
  }

  if (marks !== undefined && marks !== null) {
    if (!Array.isArray(marks)) {
      return { ok: false, status: 400, error: "marks は配列である必要があります" };
    }
    if (marks.length > MAX_MARKS) {
      return { ok: false, status: 400, error: `marks は${MAX_MARKS}件以内である必要があります` };
    }
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i] as { label?: unknown; lat?: unknown; lon?: unknown };
      if (typeof m !== "object" || m === null) {
        return { ok: false, status: 400, error: `marks[${i}] はオブジェクトである必要があります` };
      }
      if (typeof m.label !== "string" || m.label.trim().length === 0) {
        return { ok: false, status: 400, error: `marks[${i}].label は必須です` };
      }
      if (typeof m.lat !== "number" || m.lat < -90 || m.lat > 90) {
        return { ok: false, status: 400, error: `marks[${i}].lat が[-90,90]の範囲外です` };
      }
      if (typeof m.lon !== "number" || m.lon < -180 || m.lon > 180) {
        return { ok: false, status: 400, error: `marks[${i}].lon が[-180,180]の範囲外です` };
      }
    }
  }

  if (legs !== undefined && legs !== null) {
    if (!Array.isArray(legs)) {
      return { ok: false, status: 400, error: "legs は配列である必要があります" };
    }
    if (legs.length > MAX_LEGS) {
      return { ok: false, status: 400, error: `legs は${MAX_LEGS}件以内である必要があります` };
    }
    for (let i = 0; i < legs.length; i++) {
      const l = legs[i] as { label?: unknown; startSec?: unknown };
      if (typeof l !== "object" || l === null) {
        return { ok: false, status: 400, error: `legs[${i}] はオブジェクトである必要があります` };
      }
      if (typeof l.label !== "string" || l.label.trim().length === 0) {
        return { ok: false, status: 400, error: `legs[${i}].label は必須です` };
      }
      if (!Number.isInteger(l.startSec) || (l.startSec as number) < 0) {
        return { ok: false, status: 400, error: `legs[${i}].startSec は0以上の整数である必要があります` };
      }
    }
  }

  return { ok: true };
}
