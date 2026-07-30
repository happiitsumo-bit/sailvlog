import { describe, it, expect } from "vitest";
import { computeSwipeSeekStepSec, clampSeekTarget } from "../touchSeek";

describe("computeSwipeSeekStepSec（Canvas左右スワイプ±5秒シーク・UI-DESIGN §4.6/T-25）", () => {
  it("右スワイプ（閾値以上）は+5秒", () => {
    expect(computeSwipeSeekStepSec(50)).toBe(5);
  });

  it("左スワイプ（閾値以上）は-5秒", () => {
    expect(computeSwipeSeekStepSec(-50)).toBe(-5);
  });

  it("閾値未満の移動はシークしない（タップとの誤爆防止）", () => {
    expect(computeSwipeSeekStepSec(10)).toBe(0);
    expect(computeSwipeSeekStepSec(-10)).toBe(0);
  });

  it("閾値ちょうど未満の境界値", () => {
    expect(computeSwipeSeekStepSec(39.9)).toBe(0);
    expect(computeSwipeSeekStepSec(40)).toBe(5);
  });
});

describe("clampSeekTarget（シーク先を[0, durationSec]にクランプ）", () => {
  it("下限0でクランプする", () => {
    expect(clampSeekTarget(2, -5, 100)).toBe(0);
  });

  it("上限durationSecでクランプする", () => {
    expect(clampSeekTarget(98, 5, 100)).toBe(100);
  });

  it("範囲内なら加算するだけ", () => {
    expect(clampSeekTarget(50, 5, 100)).toBe(55);
  });
});
