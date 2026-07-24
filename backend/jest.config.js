/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testMatch: ["**/__tests__/**/*.test.ts"],
  // 既存の dev スクリプト（ts-node-dev --transpile-only）と同様、型チェックはtscに任せてテストは高速化する。
  // ここでの型エラー(@types/jsonwebtoken 9.0.9+ の expiresIn 型変更等)は既存コードの潜在課題でありT-01のスコープ外。
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { isolatedModules: true }],
  },
  // qa-engineer追加(T-90): テストDB(.env.test)の環境変数を最初にロードし、
  // 各テスト前に全テーブルをtruncateしてテスト間の状態汚染を防ぐ。
  setupFiles: ["<rootDir>/__tests__/setup/env.ts"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup/resetDbHook.ts"],
  testTimeout: 15000,
};
