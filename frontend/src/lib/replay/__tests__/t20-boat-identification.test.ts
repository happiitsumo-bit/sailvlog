import { describe, it, expect } from "vitest";
import { BOAT_COLORS, shortBoatLabel } from "../CanvasRenderer";

describe("BOAT_COLORS（6艇同時再生対応・§7項目8/Team Lead指摘 2026-07-25）", () => {
  it("6艇分の色を持つ（4色のみだとindex%4で5・6艇目が1・2艇目と重複する回帰を防ぐ）", () => {
    expect(BOAT_COLORS.length).toBe(6);
  });

  it("6色すべてが重複しない（同一セッション内の6艇が必ず異なる色になる）", () => {
    expect(new Set(BOAT_COLORS).size).toBe(BOAT_COLORS.length);
  });

  it("6艇インデックスをBOAT_COLORS.lengthで割った余りが全て異なる（実際の描画で使う添字ロジック）", () => {
    const indices = [0, 1, 2, 3, 4, 5];
    const colors = indices.map((i) => BOAT_COLORS[i % BOAT_COLORS.length]);
    expect(new Set(colors).size).toBe(6);
  });
});

describe("shortBoatLabel（色以外の識別手段としての常時ラベル・§7項目8）", () => {
  it("空白区切りの先頭トークンだけを表示する（自由入力の長い艇名でも遠目識別に耐える）", () => {
    expect(shortBoatLabel("4423 田中/佐藤")).toBe("4423");
    expect(shortBoatLabel("マネ艇")).toBe("マネ艇");
  });

  it("長すぎるトークンは省略記号付きで切り詰める", () => {
    expect(shortBoatLabel("ABCDEFGHIJKL")).toBe("ABCDEFG…");
  });

  it("空文字列には代替表示を返す", () => {
    expect(shortBoatLabel("   ")).toBe("?");
  });
});
