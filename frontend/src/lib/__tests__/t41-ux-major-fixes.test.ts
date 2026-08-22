// Issue #41（P9・UX Major: 表示・レイアウトの4件）の回帰テスト。
// M-1（ダーク枠線）はCSSトークンの静的検証、M-7（先制エラー）は純関数抽出、
// M-2/M-8（DOM構造・textarea化）はコンポーネントテスト基盤（RTL等）が無いため
// 既存パターン（t27-mobile-viewport.test.ts等）に倣い生ソースの構造検証で代替する。
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { contrastRatio } from "../colorContrast";
import { shouldShowSummaryError } from "../publish";

const globalsCss = readFileSync(join(__dirname, "../../app/globals.css"), "utf-8");
const sessionDetailPage = readFileSync(
  join(__dirname, "../../app/sessions/[id]/page.tsx"),
  "utf-8"
);
const publishDialog = readFileSync(
  join(__dirname, "../../components/PublishDialog.tsx"),
  "utf-8"
);

/** rgba(r,g,b,a) を黒背景(#000)に合成した実効色をhexへ（アルファ合成のalpha compositing）。 */
function flattenOverBlack(rgba: string): string {
  const m = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (!m) throw new Error(`not an rgb(a) value: ${rgba}`);
  const [, r, g, b, aStr] = m;
  const a = aStr !== undefined ? Number(aStr) : 1;
  const toHex = (c: string) => Math.round(Number(c) * a).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

describe("M-1: ダークモードで--border-strongが黒地に沈まない（Issue #41）", () => {
  it("旧値rgba(28,28,31,0.28)は黒背景でコントラスト比ほぼ1:1だった（回帰確認用の記録）", () => {
    expect(contrastRatio(flattenOverBlack("rgba(28,28,31,0.28)"), "#000000")).toBeLessThan(1.2);
  });

  it("@media (prefers-color-scheme: dark) ブロックの--border-strongが白ベースに反転している", () => {
    const darkMediaBlock = globalsCss.split('@media (prefers-color-scheme: dark)')[1].split("\n}\n")[0];
    const m = darkMediaBlock.match(/--border-strong:\s*(rgba?\([^)]+\))/);
    expect(m).not.toBeNull();
    expect(contrastRatio(flattenOverBlack(m![1]), "#000000")).toBeGreaterThanOrEqual(3);
  });

  it(':root[data-theme="dark"] ブロックの--border-strongも同様に白ベースに反転している', () => {
    const explicitDarkBlock = globalsCss.split(':root[data-theme="dark"] {')[1].split("\n}\n")[0];
    const m = explicitDarkBlock.match(/--border-strong:\s*(rgba?\([^)]+\))/);
    expect(m).not.toBeNull();
    expect(contrastRatio(flattenOverBlack(m![1]), "#000000")).toBeGreaterThanOrEqual(3);
  });

  it("ライトテーマの--border-strongは変更していない（回帰なし）", () => {
    const lightRootBlock = globalsCss.split(":root {")[1].split("\n}\n")[0];
    const m = lightRootBlock.match(/--border-strong:\s*(rgba?\([^)]+\))/);
    expect(m![1].replace(/\s/g, "")).toBe("rgba(28,28,31,0.28)");
  });
});

describe("M-7: 公開ダイアログのバリデーションエラーは初回submit試行後にのみ出す（Issue #41）", () => {
  it("未試行(submitAttempted=false)なら空欄でもエラーを出さない", () => {
    expect(shouldShowSummaryError(false, "")).toBe(false);
  });

  it("試行後(submitAttempted=true)に空欄ならエラーを出す", () => {
    expect(shouldShowSummaryError(true, "")).toBe(true);
  });

  it("試行後でも文字数が有効ならエラーを出さない", () => {
    expect(shouldShowSummaryError(true, "今日はタックの位置がよく分かった")).toBe(false);
  });

  it("試行後に上限超過ならエラーを出す", () => {
    expect(shouldShowSummaryError(true, "あ".repeat(401))).toBe(true);
  });
});

describe("M-7: 公開ダイアログの確定ボタン(.dialog-actions)が内部スクロール後も画面内に留まる構造", () => {
  it(".dialog-panel が縦flex + max-heightで、確定ボタンが.dialog-body(内部スクロール領域)の外にある", () => {
    expect(globalsCss).toMatch(/\.dialog-panel\s*\{[^}]*max-height:\s*90vh/);
    expect(globalsCss).toMatch(/\.dialog-panel\s*\{[^}]*display:\s*flex/);
    expect(globalsCss).toMatch(/\.dialog-body\s*\{[^}]*overflow-y:\s*auto/);
    // dialog-actionsがdialog-bodyの外(閉じタグの後)にあることをJSX側で確認
    const bodyCloseIndex = publishDialog.indexOf('</div>\n\n        <div className="dialog-actions">');
    expect(bodyCloseIndex).toBeGreaterThan(-1);
  });

  it("送信ボタンはsubmitting中のみ無効化される（バリデーション未達でも押せて先制エラーを回避できる）", () => {
    expect(publishDialog).toMatch(/disabled=\{submitting\}[^>]*>\s*\{submitting/);
  });
});

describe("M-2: セッション詳細のファーストビューに地図が来るよう「航跡を追加」を既定折りたたみにした（Issue #41）", () => {
  it('「航跡を追加」セクションが<details>（既定閉）で、常時表示の<section>ではない', () => {
    const idx = sessionDetailPage.indexOf("航跡を追加");
    expect(idx).toBeGreaterThan(-1);
    const before = sessionDetailPage.slice(0, idx);
    const lastDetailsOpen = before.lastIndexOf("<details");
    const lastSectionOpen = before.lastIndexOf('<section\n        aria-labelledby="add-track-heading"');
    expect(lastDetailsOpen).toBeGreaterThan(-1);
    expect(lastSectionOpen).toBe(-1);
  });
});

describe("M-8: 反省メモ入力欄がtextarea化され文字数カウンタを持つ（Issue #41）", () => {
  it("メモ入力に<textarea>を使い、1行<input type=\"text\">には戻していない", () => {
    const memoSectionIdx = sessionDetailPage.indexOf("に議論を残す");
    expect(memoSectionIdx).toBeGreaterThan(-1);
    const around = sessionDetailPage.slice(memoSectionIdx, memoSectionIdx + 1500);
    expect(around).toContain("<textarea");
    expect(around).not.toMatch(/<input\s+type="text"/);
  });

  it("文字数カウンタ（.../2000）を表示している", () => {
    expect(sessionDetailPage).toContain("newAnnotationBody.length}/2000");
  });
});
