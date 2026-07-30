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
  // qa-engineer判断(T-90, 2026-07-25): --runInBand は package.json の "test" スクリプトで指定
  // （デフォルト化）。理由・根拠は TASKS.md T-90欄と発見事項に記録。
  // 要約: 複数ワーカー並列実行では resetDbHook.ts (全テーブルTRUNCATE, beforeEach) と
  // 他ワーカーの実行中トランザクションが競合し、実測で毎回9〜22件がFK違反等でランダムに失敗する
  // （3回連続再現・失敗件数/失敗ケースは非決定的）。ワーカーごとにテストDBを分離する方式も検討したが、
  // このS規模のテスト量（8 suites/約100ケース、--runInBandで数十秒）では並列化による時間短縮の
  // 効果よりDB分離基盤の追加複雑度の方が費用対効果で見合わないと判断（原則5: S規模では割り切る）。
};
