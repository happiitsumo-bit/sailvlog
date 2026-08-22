// Issue #43（P11・UX Minorまとめ）で着手した4件（m-1/m-6/m-8/m-13）の回帰テスト。
// コンポーネントテスト基盤（RTL等）が無いため、既存パターン（t27/t41/t42）に倣い
// 生ソースの構造検証で代替する。
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const registerPage = readFileSync(join(__dirname, "../../app/register/page.tsx"), "utf-8");
const sessionsNewPage = readFileSync(join(__dirname, "../../app/sessions/new/page.tsx"), "utf-8");
const topBar = readFileSync(join(__dirname, "../../components/TopBar.tsx"), "utf-8");

describe("m-1: 登録フォームにパスワード要件を事前に明記する（Issue #43）", () => {
  it('パスワードのlabel付近に「8文字以上」の案内がある', () => {
    const idx = registerPage.indexOf('htmlFor="register-password"');
    expect(idx).toBeGreaterThan(-1);
    expect(registerPage.slice(idx, idx + 300)).toContain("8文字以上");
  });
});

describe("m-6: 壊れたGPXのエラーメッセージが警告色になっている（Issue #43）", () => {
  it("--terra（実体は--color-accent=青系）ではなく--color-dangerを使っている", () => {
    const idx = sessionsNewPage.indexOf("t.error ? (");
    expect(idx).toBeGreaterThan(-1);
    const around = sessionsNewPage.slice(idx, idx + 400);
    expect(around).toContain("--color-danger");
    expect(around).not.toContain("var(--terra)");
  });

  it("警告アイコンを併記している", () => {
    const idx = sessionsNewPage.indexOf("t.error ? (");
    const around = sessionsNewPage.slice(idx, idx + 400);
    expect(around).toContain("⚠");
  });
});

describe("m-8: 取込完了後は作成したセッションへ直行する（Issue #43）", () => {
  it("router.pushの遷移先が一覧(/sessions?teamId=)ではなく詳細(/sessions/${session.id})", () => {
    expect(sessionsNewPage).toContain("router.push(`/sessions/${session.id}`)");
    expect(sessionsNewPage).not.toContain("router.push(`/sessions?teamId=${teamId}`)");
  });
});

describe("m-13: 「公開ページを見る」を内容の分かるラベルに改名する（Issue #43）", () => {
  it('TopBarのpreviewリンクが「公開ホームを確認」に改名されている', () => {
    expect(topBar).toContain("公開ホームを確認");
    expect(topBar).not.toContain("公開ページを見る");
  });

  it("遷移先(/?preview=1)自体は変更していない（挙動は維持、表記のみ変更）", () => {
    expect(topBar).toContain('href="/?preview=1"');
  });
});
