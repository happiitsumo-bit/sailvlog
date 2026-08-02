// Issue #30: 取込時に艇ごとの記録開始時刻の差を検知するstartOffsetモジュールのユニットテスト
import { describe, test, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseGpx, normalizeToGrid, computeSessionStart } from "../parse";
import {
  computeStartOffsetSummary,
  formatOffsetSec,
  NOTABLE_OFFSET_SEC,
  LARGE_OFFSET_SEC,
} from "../startOffset";

function readFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, "../__fixtures__", name), "utf-8");
}

describe("computeStartOffsetSummary（純関数の分類ロジック）", () => {
  test("startSec=0（基準艇）はaligned", () => {
    const { offsets } = computeStartOffsetSummary([{ boatLabel: "A", startSec: 0 }]);
    expect(offsets[0].severity).toBe("aligned");
  });

  test(`しきい値未満（${NOTABLE_OFFSET_SEC - 1}秒）はaligned、しきい値以上（${NOTABLE_OFFSET_SEC}秒）はnotable`, () => {
    const { offsets } = computeStartOffsetSummary([
      { boatLabel: "aligned", startSec: NOTABLE_OFFSET_SEC - 1 },
      { boatLabel: "notable", startSec: NOTABLE_OFFSET_SEC },
    ]);
    expect(offsets[0].severity).toBe("aligned");
    expect(offsets[1].severity).toBe("notable");
  });

  test(`largeしきい値（${LARGE_OFFSET_SEC}秒）以上はlarge、直前はnotable`, () => {
    const { offsets } = computeStartOffsetSummary([
      { boatLabel: "notable", startSec: LARGE_OFFSET_SEC - 1 },
      { boatLabel: "large", startSec: LARGE_OFFSET_SEC },
    ]);
    expect(offsets[0].severity).toBe("notable");
    expect(offsets[1].severity).toBe("large");
  });

  test("allBoatsPresentAtSecは全艇中の最大startSec（＝先頭の無風区間の長さ）", () => {
    const { allBoatsPresentAtSec } = computeStartOffsetSummary([
      { boatLabel: "A", startSec: 0 },
      { boatLabel: "B", startSec: 30 },
      { boatLabel: "C", startSec: 660 },
    ]);
    expect(allBoatsPresentAtSec).toBe(660);
  });

  test("空配列はallBoatsPresentAtSec=0・offsets=[]", () => {
    const summary = computeStartOffsetSummary([]);
    expect(summary.offsets).toEqual([]);
    expect(summary.allBoatsPresentAtSec).toBe(0);
  });
});

describe("formatOffsetSec（表示文字列）", () => {
  test("0秒以下は「基準艇」表記", () => {
    expect(formatOffsetSec(0)).toBe("基準艇（0秒）");
    expect(formatOffsetSec(-1)).toBe("基準艇（0秒）");
  });

  test("60秒未満は秒のみ", () => {
    expect(formatOffsetSec(45)).toBe("45秒");
  });

  test("分単位ちょうどは「M分」のみ（0秒を出さない）", () => {
    expect(formatOffsetSec(120)).toBe("2分");
  });

  test("分と秒の両方がある場合は「M分S秒」", () => {
    expect(formatOffsetSec(665)).toBe("11分5秒");
  });
});

describe("実際のGPXパイプライン（parseGpx→computeSessionStart→normalizeToGrid）と組み合わせた検知", () => {
  test("意図的にずらしたフィクスチャ6本（0秒/5秒/10秒/11分×3艇）を通すと、notable/large判定が実データで成立する", () => {
    const fixtures = [
      { name: "boat1_clean.gpx", boatLabel: "boat1" }, // 基準（0秒）
      { name: "boat2_clean_offset5s.gpx", boatLabel: "boat2" }, // 5秒遅れ（aligned想定）
      { name: "boat3_clean_offset10s.gpx", boatLabel: "boat3" }, // 10秒遅れ（aligned想定）
      { name: "boat_offset_11min.gpx", boatLabel: "boat4" }, // 11分遅れ（large想定）
    ];
    const parsed = fixtures.map((f) => parseGpx(readFixture(f.name)));
    const sessionStart = computeSessionStart(parsed);
    const tracks = fixtures.map((f, i) => ({
      boatLabel: f.boatLabel,
      startSec: normalizeToGrid(parsed[i], sessionStart).startSec,
    }));

    const summary = computeStartOffsetSummary(tracks);

    expect(summary.offsets.find((o) => o.boatLabel === "boat1")?.severity).toBe("aligned");
    expect(summary.offsets.find((o) => o.boatLabel === "boat2")?.severity).toBe("aligned");
    expect(summary.offsets.find((o) => o.boatLabel === "boat3")?.severity).toBe("aligned");
    expect(summary.offsets.find((o) => o.boatLabel === "boat4")?.severity).toBe("large");
    // boat4(11分=660秒)より前は誰かが欠けている＝先頭に無風区間が発生している
    expect(summary.allBoatsPresentAtSec).toBe(660);
  });
});
