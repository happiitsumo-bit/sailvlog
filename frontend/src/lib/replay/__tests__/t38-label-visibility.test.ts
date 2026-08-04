import { describe, it, expect } from "vitest";
import { shouldDrawBoatLabels } from "../CanvasRenderer";

describe("shouldDrawBoatLabels（Issue #38: 静止時は艇ラベルを隠しt=0の黒い塊を解消する）", () => {
  it("再生中はラベルを表示する", () => {
    expect(shouldDrawBoatLabels(true)).toBe(true);
  });

  it("停止中（t=0の初期表示を含む）はラベルを隠す", () => {
    expect(shouldDrawBoatLabels(false)).toBe(false);
  });
});
