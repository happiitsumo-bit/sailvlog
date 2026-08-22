// Issue #40 レビュー指摘の回帰:
// セッション作成と全艇のトラック投入を1リクエストに統合したため、
// 「艇ごとに上限まで」→「全艇合計で上限まで」に変わった。
// 上限超過は express が本文パース前に413を返しアプリのエラー処理を通らないので、
// 送信前に検知して原因を説明できることを固定する。
import { describe, test, expect } from "vitest";
import {
  describeOversizedPayload,
  measurePayloadBytes,
  SESSION_BODY_LIMIT_BYTES,
} from "../importPayload";

function trackOfBytes(bytes: number) {
  return { boatLabel: "b", startSec: 0, pointCount: 1, gridJson: { lat: [0], lon: [0] }, rawGpx: "x".repeat(bytes) };
}

describe("lib/importPayload", () => {
  test("上限内なら null（通るはずのものを弾かない）", () => {
    const payload = { title: "t", tracks: [trackOfBytes(1000), trackOfBytes(1000)] };
    expect(describeOversizedPayload(payload)).toBeNull();
  });

  test("バイト数はマルチバイト文字を正しく数える（文字数ではない）", () => {
    // "艇" はUTF-8で3バイト。JSON.stringify は日本語をそのまま出すので3バイトとして数えられる
    const bytes = measurePayloadBytes({ a: "艇" });
    expect(bytes).toBe(measurePayloadBytes({ a: "abc" }));
  });

  test("上限を超えたら、艇数と合計サイズを含むメッセージを返す", () => {
    const limit = 10_000;
    const payload = { tracks: [trackOfBytes(6000), trackOfBytes(6000)] };
    const msg = describeOversizedPayload(payload, limit);
    expect(msg).not.toBeNull();
    expect(msg).toContain("2艇");
    expect(msg).toContain("大きすぎます");
    // 対処が書かれている（「失敗しました」で終わらせない）
    expect(msg).toContain("分けて");
  });

  test("1艇だけのときは「艇を分けて」と言わない（実行不能な助言を出さない）", () => {
    const limit = 5_000;
    const msg = describeOversizedPayload({ tracks: [trackOfBytes(9000)] }, limit);
    expect(msg).not.toBeNull();
    expect(msg).not.toContain("分けて");
    expect(msg).toContain("記録時間の短いGPX");
  });

  test("実測値ベースの想定: 2時間1Hz・6艇（1艇約843KB）は上限内に収まる", () => {
    // Team Lead 実測 2026-08-04: spike/gpx の2時間1Hzデータで1艇あたりPOST body 843KB
    const PER_BOAT = 843 * 1024;
    const payload = { tracks: Array.from({ length: 6 }, () => trackOfBytes(PER_BOAT)) };
    expect(describeOversizedPayload(payload, SESSION_BODY_LIMIT_BYTES)).toBeNull();
  });

  test("上限4時間×実機GPXの冗長さを見込んだ想定（1艇3MB×6艇=18MB）も収まる", () => {
    const payload = { tracks: Array.from({ length: 6 }, () => trackOfBytes(3 * 1024 * 1024)) };
    expect(describeOversizedPayload(payload, SESSION_BODY_LIMIT_BYTES)).toBeNull();
  });

  test("さらに超える規模（1艇5MB×6艇=30MB）は弾かれる", () => {
    const payload = { tracks: Array.from({ length: 6 }, () => trackOfBytes(5 * 1024 * 1024)) };
    expect(describeOversizedPayload(payload, SESSION_BODY_LIMIT_BYTES)).not.toBeNull();
  });
});
