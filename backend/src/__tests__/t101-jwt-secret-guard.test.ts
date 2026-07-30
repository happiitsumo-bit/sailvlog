// T-101 (implementer, 2026-07-28): REVIEW-backend-3.md M3-03の回帰テスト。
//
// M-05のガード(assertJwtSecretConfigured)は「リポジトリに平文で存在する値が本番に残っていたら
// 誰でもJWTを偽造できる」という前提で作られたが、docker-compose.yml/.env.testに新しく書いた
// 2値をKNOWN_PLACEHOLDERSに入れ忘れており、その2値は素通りしていた（ガードの前提が自分の手で
// 壊れていた）。M3-03修正で①新2値を追加②厳格チェックをNODE_ENV==="production"限定にした
// （.env.test/docker-compose.ymlの開発用プレースホルダ自体は非production環境で使い続けるため）。
//
// nodeEnvを明示的に第2引数で渡すことで、jestのNODE_ENV(="test")に依存せず両モードを検証する。
import { assertJwtSecretConfigured } from "../lib/assertJwtSecretConfigured";

describe("T-101 M3-03: assertJwtSecretConfigured", () => {
  test("未設定はどの環境でもthrow", () => {
    expect(() => assertJwtSecretConfigured(undefined, "production")).toThrow(/未設定/);
    expect(() => assertJwtSecretConfigured("", "development")).toThrow(/未設定/);
  });

  test("production環境: 既知の3プレースホルダはいずれもthrow", () => {
    expect(() => assertJwtSecretConfigured("change_this_secret_in_production", "production")).toThrow();
    expect(() =>
      assertJwtSecretConfigured("dev-only-jwt-secret-change-me-1234567890abcdef", "production")
    ).toThrow();
    expect(() =>
      assertJwtSecretConfigured("test_secret_do_not_use_in_prod_1234567890", "production")
    ).toThrow();
  });

  test("production環境: 32文字未満はthrow", () => {
    expect(() => assertJwtSecretConfigured("a".repeat(31), "production")).toThrow(/短すぎます/);
  });

  test("production環境: 32文字以上のランダムな値は通る", () => {
    expect(() =>
      assertJwtSecretConfigured("a".repeat(32) + "-not-a-known-placeholder", "production")
    ).not.toThrow();
  });

  test("非production環境: 既知のプレースホルダ・短い値でもthrowしない（開発・テストの摩擦を上げない）", () => {
    expect(() => assertJwtSecretConfigured("test_secret_do_not_use_in_prod_1234567890", "test")).not.toThrow();
    expect(() => assertJwtSecretConfigured("dev-only-jwt-secret-change-me-1234567890abcdef", "development")).not.toThrow();
    expect(() => assertJwtSecretConfigured("short", "test")).not.toThrow();
  });
});
