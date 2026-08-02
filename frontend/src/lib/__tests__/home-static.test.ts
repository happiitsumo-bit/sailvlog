// SPEC-home-static.md §6: 公開ホーム（縦切り第1スライス）のテスト T-a〜T-d。
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { showBottomTabBar } from "../navVisibility";
import { HERO_POSTER, HOME_FEATURES } from "../home";

describe("T-a: showBottomTabBar（ナビ可視性ユニット・T-33原則の自動検知化）", () => {
  it("/p/[slug] 配下は false", () => {
    expect(showBottomTabBar("/p/abc")).toBe(false);
  });
  it("公開ホーム / は false", () => {
    expect(showBottomTabBar("/")).toBe(false);
  });
  it("/blog は false", () => {
    expect(showBottomTabBar("/blog")).toBe(false);
  });
  it("/blog/why-2d は false", () => {
    expect(showBottomTabBar("/blog/why-2d")).toBe(false);
  });
  it("/sessions は true", () => {
    expect(showBottomTabBar("/sessions")).toBe(true);
  });
  it("/handbook は true", () => {
    expect(showBottomTabBar("/handbook")).toBe(true);
  });
});

describe("T-b: HOME_FEATURES（ホームデータ整合ユニット）", () => {
  it("4件である", () => {
    expect(HOME_FEATURES).toHaveLength(4);
  });
  it("全件に title / description / alt が非空で存在する", () => {
    for (const feature of HOME_FEATURES) {
      expect(feature.title.trim().length).toBeGreaterThan(0);
      expect(feature.description.trim().length).toBeGreaterThan(0);
      expect(feature.alt.trim().length).toBeGreaterThan(0);
    }
  });
  it("画像パスが /screenshots/ 配下である", () => {
    for (const feature of HOME_FEATURES) {
      expect(feature.image.startsWith("/screenshots/")).toBe(true);
    }
  });
});

describe("T-c: 素材実在スモーク", () => {
  const publicDir = path.join(__dirname, "..", "..", "..", "public");

  it("HERO_POSTER の画像が public/ 配下に実在する", () => {
    expect(fs.existsSync(path.join(publicDir, HERO_POSTER.src))).toBe(true);
  });

  it("HOME_FEATURES の全画像が public/ 配下に実在する", () => {
    for (const feature of HOME_FEATURES) {
      expect(fs.existsSync(path.join(publicDir, feature.image))).toBe(true);
    }
  });
});

describe("T-d: API非依存スモーク", () => {
  const forbiddenAll = ["fetch(", "apiFetch", "NEXT_PUBLIC_API_URL"];
  const forbiddenPageOnly = ["\"use client\"", "useEffect"];

  function readSource(...segments: string[]): string {
    return fs.readFileSync(path.join(__dirname, "..", "..", ...segments), "utf-8");
  }

  it("app/page.tsx が use client・fetch・apiFetch・NEXT_PUBLIC_API_URL・useEffect のいずれも含まない", () => {
    const src = readSource("app", "page.tsx");
    for (const needle of [...forbiddenAll, ...forbiddenPageOnly]) {
      expect(src.includes(needle)).toBe(false);
    }
  });

  it("components/home/*.tsx が fetch・apiFetch・NEXT_PUBLIC_API_URL を含まない", () => {
    const dir = path.join(__dirname, "..", "..", "components", "home");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = fs.readFileSync(path.join(dir, file), "utf-8");
      for (const needle of forbiddenAll) {
        expect(src.includes(needle)).toBe(false);
      }
    }
  });
});
