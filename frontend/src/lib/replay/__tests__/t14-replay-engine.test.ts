import { describe, it, expect } from "vitest";
import { computeProjection, project, isIndexInGap, splitByGapRuns, RenderTrack } from "../geo";
import { ReplayClock } from "../ReplayClock";
import { getTrackEmphasis } from "../CanvasRenderer";

function track(overrides: Partial<RenderTrack> = {}): RenderTrack {
  return {
    id: 1,
    boatLabel: "boat1",
    startSec: 0,
    pointCount: 4,
    gridJson: { lat: [35.0, 35.001, 35.002, 35.003], lon: [139.0, 139.001, 139.002, 139.003], gaps: [] },
    ...overrides,
  };
}

describe("lib/replay/geo (T-14)", () => {
  it("computeProjection returns null when no tracks have points", () => {
    expect(computeProjection([], 800, 600)).toBeNull();
    expect(computeProjection([track({ gridJson: { lat: [], lon: [], gaps: [] } })], 800, 600)).toBeNull();
  });

  it("project places the northernmost point higher on screen (smaller y) than the southernmost", () => {
    const t = track({ gridJson: { lat: [35.0, 35.01], lon: [139.0, 139.0], gaps: [] } });
    const proj = computeProjection([t], 800, 600)!;
    const [, ySouth] = project(proj, 35.0, 139.0);
    const [, yNorth] = project(proj, 35.01, 139.0);
    expect(yNorth).toBeLessThan(ySouth);
  });

  it("project keeps all points within the canvas bounds (with margin)", () => {
    const t = track({
      gridJson: {
        lat: [35.0, 35.02, 35.01],
        lon: [139.0, 139.02, 139.01],
        gaps: [],
      },
    });
    const proj = computeProjection([t], 800, 600, 40)!;
    for (let i = 0; i < t.gridJson.lat.length; i++) {
      const [x, y] = project(proj, t.gridJson.lat[i], t.gridJson.lon[i]);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(800);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(600);
    }
  });

  it("isIndexInGap detects membership in any recorded gap range", () => {
    const gaps: [number, number][] = [[2, 4], [10, 10]];
    expect(isIndexInGap(gaps, 0)).toBe(false);
    expect(isIndexInGap(gaps, 2)).toBe(true);
    expect(isIndexInGap(gaps, 3)).toBe(true);
    expect(isIndexInGap(gaps, 4)).toBe(true);
    expect(isIndexInGap(gaps, 5)).toBe(false);
    expect(isIndexInGap(gaps, 10)).toBe(true);
  });

  it("splitByGapRuns splits a range into solid/dashed runs at gap boundaries", () => {
    const gaps: [number, number][] = [[3, 5]];
    const runs = splitByGapRuns(gaps, 0, 8);
    expect(runs).toEqual([
      { from: 0, to: 2, dashed: false },
      { from: 2, to: 5, dashed: true },
      { from: 5, to: 8, dashed: false },
    ]);
  });

  it("splitByGapRuns returns a single dashed run when the whole range is inside a gap", () => {
    const runs = splitByGapRuns([[0, 10]], 2, 6);
    expect(runs).toEqual([{ from: 2, to: 6, dashed: true }]);
  });

  it("splitByGapRuns returns a single solid run when there are no gaps", () => {
    const runs = splitByGapRuns([], 0, 5);
    expect(runs).toEqual([{ from: 0, to: 5, dashed: false }]);
  });
});

describe("ReplayClock (T-14 ADR-001 rAF+ref)", () => {
  it("does not advance simTime while paused", () => {
    const clock = new ReplayClock(100);
    clock.tick(1000);
    expect(clock.simTimeSec).toBe(0);
  });

  it("advances simTime by deltaMs/1000 * speed while playing", () => {
    const clock = new ReplayClock(100);
    clock.play();
    clock.tick(2000); // 2s @ 1x
    expect(clock.simTimeSec).toBe(2);
    clock.setSpeed(4);
    clock.tick(1000); // 1s @ 4x
    expect(clock.simTimeSec).toBe(6);
  });

  it("clamps to durationSec and auto-pauses at the end", () => {
    const clock = new ReplayClock(10);
    clock.play();
    clock.tick(20000); // far past the end
    expect(clock.simTimeSec).toBe(10);
    expect(clock.playing).toBe(false);
  });

  it("seekTo clamps into [0, durationSec] regardless of play state", () => {
    const clock = new ReplayClock(50);
    clock.seekTo(-5);
    expect(clock.simTimeSec).toBe(0);
    clock.seekTo(999);
    expect(clock.simTimeSec).toBe(50);
    clock.seekTo(20);
    expect(clock.simTimeSec).toBe(20);
  });
});

describe("2艇比較の描画強調", () => {
  it("2艇未満の選択では全艇を通常表示する", () => {
    expect(getTrackEmphasis(1, new Set())).toEqual({ alpha: 1, lineWidth: 1.5, markerRadius: 5 });
    expect(getTrackEmphasis(1, new Set([1]))).toEqual({ alpha: 1, lineWidth: 1.5, markerRadius: 5 });
  });

  it("2艇選択時は対象艇を強調し、その他を減光する", () => {
    const compared = new Set([1, 2]);
    expect(getTrackEmphasis(1, compared)).toEqual({ alpha: 1, lineWidth: 3, markerRadius: 7 });
    expect(getTrackEmphasis(3, compared)).toEqual({ alpha: 0.16, lineWidth: 1, markerRadius: 4 });
  });
});
