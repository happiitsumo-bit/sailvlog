// Issue #27 項目3: リプレイ画面の操作系（シークバー・艇の表示チェックボックス・速度/レグチップ）の
// タップ領域の回帰確認。t27-mobile-viewport.test.tsと同じ手法（globals.cssの生ソースをテキスト検証）。
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readGlobalsCss(): string {
  return fs.readFileSync(path.join(__dirname, "..", "..", "app", "globals.css"), "utf-8");
}

// globals.cssには `@media (max-width: 767px) { ... }` ブロックが複数箇所に分かれて存在する
// （767pxはこのプロジェクトの標準モバイルブレークポイント）。全ブロックの範囲を集める。
function allMobileBlockRanges(css: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf("@media (max-width: 767px)", from);
    if (start === -1) break;
    const braceOpen = css.indexOf("{", start);
    let depth = 1;
    let i = braceOpen + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    ranges.push([start, i]);
    from = i;
  }
  expect(ranges.length, "767pxのモバイルメディアクエリが見つからない").toBeGreaterThan(0);
  return ranges;
}

function isInsideAnyRange(index: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([s, e]) => index >= s && index < e);
}

// selectorの全出現箇所のうち、モバイルメディアクエリ内/外のブロックをそれぞれ返す
function findRuleBlocks(css: string, selector: string, ranges: Array<[number, number]>) {
  const inMobile: string[] = [];
  const outsideMobile: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(`${selector} {`, from);
    if (start === -1) break;
    const end = css.indexOf("}", start);
    const block = css.slice(start, end);
    if (isInsideAnyRange(start, ranges)) inMobile.push(block);
    else outsideMobile.push(block);
    from = start + 1;
  }
  return { inMobile, outsideMobile };
}

describe("Issue #27 項目3: モバイル幅でのリプレイ操作系タップ領域（Apple HIG 44x44px目安）", () => {
  const css = readGlobalsCss();
  const ranges = allMobileBlockRanges(css);

  it("速度・レグチップ（.filter-chip）が44pxの最小高さを持つ", () => {
    const { inMobile } = findRuleBlocks(css, ".replay-controls .filter-chip,\n  .replay-legs-row .filter-chip", ranges);
    expect(inMobile.length).toBeGreaterThan(0);
    expect(inMobile[0]).toContain("min-height: 44px;");
  });

  it("艇の表示チェックボックス（.replay-boat-toggle）が44pxの最小高さを持つ", () => {
    const { inMobile } = findRuleBlocks(css, ".replay-boat-toggle", ranges);
    expect(inMobile.length).toBeGreaterThan(0);
    expect(inMobile.some((b) => b.includes("min-height: 44px;"))).toBe(true);
  });

  it("シークバー（.replay-seek-input）が44pxの高さを持つ", () => {
    const { inMobile } = findRuleBlocks(css, ".replay-seek-input", ranges);
    expect(inMobile.length).toBeGreaterThan(0);
    expect(inMobile[0]).toContain("height: 44px;");
  });

  it("TopBarの副次導線（.topbar-preview-link）を隠し、ログイン済みモバイル幅での横スクロールを防ぐ", () => {
    const { inMobile } = findRuleBlocks(css, ".topbar-preview-link", ranges);
    expect(inMobile.length).toBeGreaterThan(0);
    expect(inMobile[0]).toContain("display: none;");
  });
});

describe("Issue #27 項目3: .replay-boat-toggle のデスクトップ既定値（WCAG 2.2 Target Size 24px）", () => {
  const css = readGlobalsCss();
  const ranges = allMobileBlockRanges(css);

  it("メディアクエリ外（デスクトップ既定）で24pxの最小高さを持つ（767px以下では44pxへ拡大）", () => {
    const { outsideMobile } = findRuleBlocks(css, ".replay-boat-toggle", ranges);
    expect(outsideMobile.length).toBeGreaterThan(0);
    expect(outsideMobile[0]).toContain("min-height: 24px;");
  });
});
