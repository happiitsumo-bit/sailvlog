import { describe, it, expect } from "vitest";
import { contrastRatio, relativeLuminance } from "../colorContrast";

describe("colorContrast（既知値での検算）", () => {
  it("白と黒のコントラスト比は21:1", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });

  it("同色のコントラスト比は1:1", () => {
    expect(contrastRatio("#2f9fd1", "#2f9fd1")).toBeCloseTo(1, 5);
  });

  it("白の相対輝度は1、黒は0", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });
});

describe("UI-DESIGN §7項目9: ダークテーマの--color-accentコントラスト是正（2026-07-25）", () => {
  it("旧dark値#2f9fd1は白文字とのコントラストがWCAG AA(4.5:1)未達だった（回帰確認用の記録）", () => {
    expect(contrastRatio("#ffffff", "#2f9fd1")).toBeLessThan(4.5);
  });

  it("新dark値#177baeは白文字とのコントラストがWCAG AA(4.5:1)を満たす", () => {
    const ratio = contrastRatio("#ffffff", "#177bae");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("light値#0b6a9eは引き続きAAを満たす（今回変更していないことの回帰確認）", () => {
    expect(contrastRatio("#ffffff", "#0b6a9e")).toBeGreaterThanOrEqual(4.5);
  });
});
