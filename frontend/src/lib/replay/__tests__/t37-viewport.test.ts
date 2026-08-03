import { describe, it, expect } from "vitest";
import {
  IDENTITY_VIEWPORT,
  resetViewport,
  zoomAt,
  panBy,
  applyViewport,
  pinchDistance,
  pinchMidpoint,
} from "../viewport";

describe("lib/replay/viewport (Issue #37 ズーム・パン)", () => {
  it("applyViewport is the identity transform at IDENTITY_VIEWPORT", () => {
    expect(applyViewport(IDENTITY_VIEWPORT, 12, 34)).toEqual([12, 34]);
  });

  it("resetViewport always returns a fresh identity viewport (no shared mutation)", () => {
    const a = resetViewport();
    const b = resetViewport();
    expect(a).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(a).not.toBe(b);
  });

  it("panBy translates by screen pixels regardless of current zoom", () => {
    const v = panBy({ zoom: 3, panX: 10, panY: -5 }, 4, 6);
    expect(v).toEqual({ zoom: 3, panX: 14, panY: 1 });
  });

  it("zoomAt keeps the point under the cursor fixed on screen", () => {
    const v0 = IDENTITY_VIEWPORT;
    const cx = 100;
    const cy = 200;
    const v1 = zoomAt(v0, cx, cy, 2);
    expect(v1.zoom).toBe(2);
    // カーソル位置自身の投影後座標は変化しない
    const [sx, sy] = applyViewport(v1, (cx - v0.panX) / v0.zoom, (cy - v0.panY) / v0.zoom);
    expect(sx).toBeCloseTo(cx, 6);
    expect(sy).toBeCloseTo(cy, 6);
  });

  it("zoomAt clamps to [minZoom, maxZoom]", () => {
    expect(zoomAt(IDENTITY_VIEWPORT, 0, 0, 0.01, 1, 20).zoom).toBe(1);
    expect(zoomAt(IDENTITY_VIEWPORT, 0, 0, 100, 1, 20).zoom).toBe(20);
  });

  it("zoomAt is a no-op on position when factor is 1", () => {
    const v = { zoom: 2.5, panX: 7, panY: -3 };
    expect(zoomAt(v, 50, 50, 1)).toEqual(v);
  });

  it("pinchDistance computes Euclidean distance between two touch points", () => {
    expect(pinchDistance(0, 0, 3, 4)).toBe(5);
    expect(pinchDistance(10, 10, 10, 10)).toBe(0);
  });

  it("pinchMidpoint computes the midpoint between two touch points", () => {
    expect(pinchMidpoint(0, 0, 10, 20)).toEqual([5, 10]);
  });

  it("repeated zoomAt composes multiplicatively (pinch-in then pinch-out returns to start)", () => {
    let v = IDENTITY_VIEWPORT;
    v = zoomAt(v, 300, 150, 2);
    v = zoomAt(v, 300, 150, 0.5);
    expect(v.zoom).toBeCloseTo(1, 10);
    expect(v.panX).toBeCloseTo(0, 10);
    expect(v.panY).toBeCloseTo(0, 10);
  });
});
