// Issue #28: PWA化（ホーム画面に追加できるようにする）の回帰確認。
// manifest.webmanifestの妥当性・アイコン実在・layout.tsxの配線、
// および色トークンが design-system/theme.json とズレていないことを検証する。
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const publicDir = path.join(__dirname, "..", "..", "..", "public");
const themePath = path.join(__dirname, "..", "..", "..", "..", "design-system", "theme.json");

function readManifest() {
  const raw = fs.readFileSync(path.join(publicDir, "manifest.webmanifest"), "utf-8");
  return JSON.parse(raw);
}

describe("Issue #28: manifest.webmanifest の妥当性", () => {
  const manifest = readManifest();

  it("必須キーが揃っている", () => {
    for (const key of ["name", "short_name", "start_url", "display", "background_color", "theme_color", "icons"]) {
      expect(manifest).toHaveProperty(key);
    }
  });

  it("display は standalone（ホーム画面追加時にブラウザUIを隠す）", () => {
    expect(manifest.display).toBe("standalone");
  });

  it("192x192 と 512x512 のアイコンを含み、実ファイルが public/ 配下に存在する", () => {
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const icon of manifest.icons as Array<{ src: string }>) {
      expect(fs.existsSync(path.join(publicDir, icon.src.replace(/^\//, "")))).toBe(true);
    }
  });

  it("background_color / theme_color が design-system/theme.json のトークンと一致する（ハードコード値の追跡）", () => {
    const theme = JSON.parse(fs.readFileSync(themePath, "utf-8"));
    expect(manifest.theme_color).toBe(theme.accentHueShift.light.accent);
    expect(manifest.background_color).toBe(theme.color.surface.light.canvas);
  });
});

describe("Issue #28: apple-touch-icon の実在", () => {
  it("frontend/public/apple-touch-icon.png が存在する（iOSはmanifestのアイコンを使わないため必須）", () => {
    expect(fs.existsSync(path.join(publicDir, "apple-touch-icon.png"))).toBe(true);
  });
});

describe("Issue #28: layout.tsx の配線", () => {
  it("metadata.manifest と icons.apple、viewport.themeColor が設定されている", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "..", "app", "layout.tsx"), "utf-8");
    expect(src).toContain('manifest: "/manifest.webmanifest"');
    expect(src).toContain('apple: "/apple-touch-icon.png"');
    expect(src).toContain("themeColor");
  });
});
