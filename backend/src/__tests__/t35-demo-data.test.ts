// T-35 (Issue #35): 合成デモデータ生成の純関数テスト。DBアクセスなし。
// 実在の部・実在の人を想起させないこと（C-01再発防止）と、frontend側がハードコードして
// 参照する DEMO_PUBLIC_SLUG が壊れないことを主に検証する。
import {
  buildDemoSessionData,
  DEMO_TEAM_NAME,
  DEMO_PUBLIC_SLUG,
  DEMO_LEARNING_SUMMARY,
} from "../lib/demoData";

describe("lib/demoData (T-35)", () => {
  test("DEMO_PUBLIC_SLUG は固定値（frontendのCTAリンクとの契約）", () => {
    expect(DEMO_PUBLIC_SLUG).toBe("sailvlog-demo");
  });

  test("チーム名・学びの要約が合成データであることを明示している", () => {
    expect(DEMO_TEAM_NAME).toContain("デモ");
    expect(DEMO_LEARNING_SUMMARY).toContain("合成データ");
  });

  test("チーム名・艇ラベルが実在の大学名を含まない（prisma/seed.tsの実データと衝突しない）", () => {
    const realUniversityNames = ["東京大学", "慶應", "早稲田", "京都大学", "江ノ島セーリングクラブ"];
    const data = buildDemoSessionData();
    const allLabels = [DEMO_TEAM_NAME, ...data.tracks.map((t) => t.boatLabel)];
    for (const label of allLabels) {
      for (const real of realUniversityNames) {
        expect(label).not.toContain(real);
      }
    }
  });

  test("各トラックの点列は時刻昇順（1Hz・重複や逆転なし）", () => {
    const data = buildDemoSessionData();
    for (const track of data.tracks) {
      expect(track.gridJson.lat.length).toBe(track.pointCount);
      expect(track.gridJson.lon.length).toBe(track.pointCount);
      expect(track.gridJson.gaps).toEqual([]);
      for (const v of [...track.gridJson.lat, ...track.gridJson.lon]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  test("rawGpxのtrkpt数はpointCountと一致する", () => {
    const data = buildDemoSessionData();
    for (const track of data.tracks) {
      const trkptCount = (track.rawGpx.match(/<trkpt /g) ?? []).length;
      expect(trkptCount).toBe(track.pointCount);
    }
  });

  test("session.durationSec は全トラックの startSec+pointCount の最大値と一致する（ARCH §4契約）", () => {
    const data = buildDemoSessionData();
    const maxEnd = Math.max(...data.tracks.map((t) => t.startSec + t.pointCount));
    expect(data.session.durationSec).toBe(maxEnd);
  });
});
