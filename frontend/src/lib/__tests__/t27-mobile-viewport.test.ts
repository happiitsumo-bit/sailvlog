// Issue #27: モバイル実機での使い勝手（safe-area・100dvh・タップ領域）の回帰確認。
// グローバルCSSの静的アサーションのみ（home-static.test.ts T-dと同じ手法: 生ソースをreadFileSyncしてテキスト検証）。
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readGlobalsCss(): string {
  return fs.readFileSync(path.join(__dirname, "..", "..", "app", "globals.css"), "utf-8");
}

function extractRuleBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `selector "${selector}" not found in globals.css`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

describe("Issue #27: 100vh -> 100dvh フォールバック", () => {
  const css = readGlobalsCss();

  it("body は 100vh をフォールバックとして残しつつ 100dvh も宣言する", () => {
    const block = extractRuleBlock(css, "body");
    expect(block).toContain("100vh");
    expect(block).toContain("100dvh");
  });

  it(".app-shell は 100vh をフォールバックとして残しつつ 100dvh も宣言する", () => {
    const block = extractRuleBlock(css, ".app-shell");
    expect(block).toContain("100vh");
    expect(block).toContain("100dvh");
  });
});

describe("Issue #27: .bottom-tab-bar の safe-area-inset（縦横両対応）", () => {
  const css = readGlobalsCss();

  it("下・左・右の safe-area-inset をすべて確保する", () => {
    const block = extractRuleBlock(css, ".bottom-tab-bar");
    expect(block).toContain("env(safe-area-inset-bottom)");
    expect(block).toContain("env(safe-area-inset-left)");
    expect(block).toContain("env(safe-area-inset-right)");
  });
});

describe("Issue #27: モバイル幅でのタップ領域（Apple HIG 44x44px目安）", () => {
  const css = readGlobalsCss();

  it(".bottom-tab-item は44x44pxの最小タップ領域を持つ", () => {
    const block = extractRuleBlock(css, ".bottom-tab-item");
    expect(block).toContain("min-width: 44px");
    expect(block).toContain("min-height: 44px");
  });

  it("max-width: 767px のメディアクエリ内で .btn に44pxの最小高さを与える", () => {
    const mobileStart = css.indexOf("@media (max-width: 767px)");
    expect(mobileStart).toBeGreaterThanOrEqual(0);
    const nextMediaStart = css.indexOf("@media", mobileStart + 1);
    const mobileBlock = css.slice(mobileStart, nextMediaStart === -1 ? undefined : nextMediaStart);
    expect(mobileBlock).toContain(".btn { min-height: 44px; }");
  });
});
