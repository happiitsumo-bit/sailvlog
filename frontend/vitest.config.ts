// qa-engineer (T-90): frontend/src/lib/gpx（純関数モジュール、T-11）のユニットテスト用。
// DOMParserを使うためjsdom環境で実行する。Next.js本体のビルド設定には影響しない（別プロセスで動く独立ツール）。
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
