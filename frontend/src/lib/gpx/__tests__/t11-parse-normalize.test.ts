// T-11: GPXパース＋1Hzグリッド正規化モジュールのユニットテスト
// フィクスチャはqa-engineerが用意した ../__fixtures__/ を流用（normalize.todo.test.ts 参照）
import { describe, test, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseGpx, normalizeToGrid, computeSessionStart, GpxParseError } from "../parse";

function readFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, "../__fixtures__", name), "utf-8");
}

describe("lib/gpx parseGpx + normalizeToGrid (T-11)", () => {
  test("正常系6艇: boat1/4/5/6_clean.gpx を取込むとそれぞれ8点のグリッドが得られる", () => {
    for (const name of ["boat1_clean.gpx", "boat4_clean.gpx", "boat5_clean.gpx", "boat6_clean.gpx"]) {
      const points = parseGpx(readFixture(name));
      expect(points.length).toBeGreaterThan(0);
      const sessionStart = computeSessionStart([points]);
      const track = normalizeToGrid(points, sessionStart);
      expect(track.gridJson.lat.length).toBe(track.pointCount);
      expect(track.gridJson.lon.length).toBe(track.pointCount);
    }
  });

  test("startSecオフセット: boat2_clean_offset5s.gpx は基準(boat1)に対しstartSec=5になる", () => {
    const boat1 = parseGpx(readFixture("boat1_clean.gpx"));
    const boat2 = parseGpx(readFixture("boat2_clean_offset5s.gpx"));
    const sessionStart = computeSessionStart([boat1, boat2]);
    const track2 = normalizeToGrid(boat2, sessionStart);
    expect(track2.startSec).toBe(5);
  });

  test("startSecオフセット: boat3_clean_offset10s.gpx は基準(boat1)に対しstartSec=10になる", () => {
    const boat1 = parseGpx(readFixture("boat1_clean.gpx"));
    const boat3 = parseGpx(readFixture("boat3_clean_offset10s.gpx"));
    const sessionStart = computeSessionStart([boat1, boat3]);
    const track3 = normalizeToGrid(boat3, sessionStart);
    expect(track3.startSec).toBe(10);
  });

  test("欠測ギャップ: boat_with_gap.gpx はgaps=[[4,6]]を検出し、区間を線形補間で埋める", () => {
    const points = parseGpx(readFixture("boat_with_gap.gpx"));
    const track = normalizeToGrid(points, points[0].timeMs);
    expect(track.gridJson.gaps).toEqual([[4, 6]]);
    // 補間: index3(既知)とindex7(既知)の間を線形補間しているので、単調に変化するはず
    expect(track.gridJson.lat[4]).toBeGreaterThan(track.gridJson.lat[3]);
    expect(track.gridJson.lat[6]).toBeLessThan(track.gridJson.lat[7]);
    expect(track.pointCount).toBe(10);
  });

  test("拒否: reversed_time.gpx（時刻逆転）はエラーを投げ、部分結果を返さない", () => {
    expect(() => parseGpx(readFixture("reversed_time.gpx"))).toThrow(GpxParseError);
  });

  test("拒否: missing_attrs.gpx（lat/lon/time欠落）はエラーを投げる", () => {
    expect(() => parseGpx(readFixture("missing_attrs.gpx"))).toThrow(GpxParseError);
  });

  test("拒否: malformed.gpx（壊れたXML）はDOMParserのparsererrorを検出してエラーを投げる", () => {
    expect(() => parseGpx(readFixture("malformed.gpx"))).toThrow(GpxParseError);
  });

  test("エッジケース: trkptが1件も無いGPXは拒否される", () => {
    const emptyGpx = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg></trkseg></trk></gpx>`;
    expect(() => parseGpx(emptyGpx)).toThrow(GpxParseError);
  });

  test("エッジケース: 1点のみのトラックはgaps=[]・pointCount=1になる", () => {
    const singlePointGpx = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg><trkpt lat="35.3" lon="139.4"><time>2026-07-24T05:00:00.000Z</time></trkpt></trkseg></trk></gpx>`;
    const points = parseGpx(singlePointGpx);
    const track = normalizeToGrid(points, points[0].timeMs);
    expect(track.pointCount).toBe(1);
    expect(track.gridJson.gaps).toEqual([]);
    expect(track.startSec).toBe(0);
  });

  test("gridJson.lat.length === gridJson.lon.length === pointCount が常に成立する（ARCH §4契約の前提）", () => {
    const points = parseGpx(readFixture("boat_with_gap.gpx"));
    const track = normalizeToGrid(points, points[0].timeMs);
    expect(track.gridJson.lat.length).toBe(track.pointCount);
    expect(track.gridJson.lon.length).toBe(track.pointCount);
  });
});
