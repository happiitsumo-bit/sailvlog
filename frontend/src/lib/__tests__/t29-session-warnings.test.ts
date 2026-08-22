// M4-03対応: R-05（公開中セッションへの変更確認）の判定純関数を固定するテスト。
// 元は frontend/src/app/sessions/[id]/page.tsx に埋まっていた分岐（sessionIsPublished 等）を
// lib/publish.ts の純関数へ抽出し、DOMを介さずユニットテストできるようにした（REVIEW-4.md M4-03）。
import { describe, expect, it } from "vitest";
import {
  sessionIsPublished,
  shouldWarnBeforeAnnotationEdit,
  shouldWarnBeforeTrackAdd,
} from "../publish";
import { Annotation, SessionDetail } from "@/types";

function makeDetail(visibility: SessionDetail["session"]["visibility"]): SessionDetail {
  return {
    session: {
      id: 1,
      title: "テスト練習",
      type: "practice",
      startedAt: "2026-08-01T00:00:00.000Z",
      durationSec: 3600,
      createdAt: "2026-08-01T00:00:00.000Z",
      teamId: 1,
      uploaderId: 1,
      visibility,
      _count: { tracks: 0, annotations: 0 },
      mySubmitted: false,
    },
    tracks: [],
    annotations: [],
  };
}

function makeAnnotation(isPublic: boolean): Annotation {
  return {
    id: 1,
    sessionId: 1,
    authorId: 1,
    tSec: 0,
    body: "気づき",
    createdAt: "2026-08-01T00:00:00.000Z",
    isPublic,
  };
}

describe("T-29/M4-03: sessionIsPublished", () => {
  it("visibility=teamはfalse（非公開）", () => {
    expect(sessionIsPublished(makeDetail("team"))).toBe(false);
  });
  it("visibility=unlistedはtrue（公開中扱い）", () => {
    expect(sessionIsPublished(makeDetail("unlisted"))).toBe(true);
  });
  it("visibility=publicはtrue", () => {
    expect(sessionIsPublished(makeDetail("public"))).toBe(true);
  });
  it("detail未取得（null）はfalse", () => {
    expect(sessionIsPublished(null)).toBe(false);
  });
});

describe("T-29/M4-03: shouldWarnBeforeTrackAdd（R-05: 航跡追加）", () => {
  it("公開中セッション（public）へのトラック追加は警告を出す", () => {
    expect(shouldWarnBeforeTrackAdd(makeDetail("public"))).toBe(true);
  });
  it("公開中セッション（unlisted）へのトラック追加も警告を出す", () => {
    expect(shouldWarnBeforeTrackAdd(makeDetail("unlisted"))).toBe(true);
  });
  it("非公開（team）セッションへのトラック追加は警告を出さない", () => {
    expect(shouldWarnBeforeTrackAdd(makeDetail("team"))).toBe(false);
  });
});

describe("T-29/M4-03: shouldWarnBeforeAnnotationEdit（R-05: 注釈編集の粒度）", () => {
  it("公開中セッション × 既存の公開注釈(isPublic=true)の編集 → 警告を出す", () => {
    expect(shouldWarnBeforeAnnotationEdit(makeDetail("public"), makeAnnotation(true))).toBe(true);
  });
  it("公開中セッション × 新規注釈相当(isPublic=false)の編集 → 警告を出さない", () => {
    expect(shouldWarnBeforeAnnotationEdit(makeDetail("public"), makeAnnotation(false))).toBe(
      false
    );
  });
  it("非公開（team）セッション × 公開注釈(isPublic=true)の編集 → 警告を出さない", () => {
    expect(shouldWarnBeforeAnnotationEdit(makeDetail("team"), makeAnnotation(true))).toBe(false);
  });
  it("非公開（team）セッション × 非公開注釈(isPublic=false)の編集 → 警告を出さない", () => {
    expect(shouldWarnBeforeAnnotationEdit(makeDetail("team"), makeAnnotation(false))).toBe(false);
  });
});
