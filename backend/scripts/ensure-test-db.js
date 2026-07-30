#!/usr/bin/env node
/**
 * qa-engineer (T-90): backendのテストDB(sailvlog_test)を用意する。
 *
 * 手順:
 *   1. .env.test の DATABASE_URL が指すDBが無ければ CREATE DATABASE する
 *      （maintenance DB "postgres" に接続して発行。無ければ既存扱いで続行）
 *   2. そのDBに対して `prisma migrate deploy` を実行し、既存migrationを適用する
 *
 * ローカル(docker-compose の db サービス, localhost:5433)・CI(postgres serviceコンテナ, 同ポート)
 * のどちらでも同じ .env.test 定義で動く想定。`npm test` の pretest フックから自動実行される。
 */
"use strict";
const path = require("path");
const dotenv = require("dotenv");
const { Client } = require("pg");
const { execFileSync } = require("child_process");

// m3-01修正（2026-07-28, REVIEW-backend-3.md）: setup/env.ts は override: true にしたが、
// このスクリプトだけ override 無し（既定false）のままだった。シェルに DATABASE_URL 等が
// 既にexportされていると、pretest（このスクリプト）はシェルのDBを見てmigrate deployし、
// jest本体（setup/env.ts経由）は.env.testのDBを見る、という食い違いが起きる
// （症状は「テーブルが存在しません」で原因が分かりにくい。B-01のホスト/DB名ガードにより
// 事故には至らないが、混乱の元だった）。setup/env.tsと同じくoverride: trueで揃える。
dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });

const testUrl = process.env.DATABASE_URL;
if (!testUrl) {
  console.error("[test-db] .env.test に DATABASE_URL がありません");
  process.exit(1);
}

const target = new URL(testUrl);
const dbName = target.pathname.replace(/^\//, "");

// B-01修正（2026-07-27, REVIEW-backend-2.md）: 従来は「DB名が空 or "postgres" でないこと」
// しか見ておらず、Neonの本番DB名（例: "sailvlog"や"neondb"）はこのガードを素通りしていた。
// 「テスト用の設定として妥当か」を多層で検証し、1つでも満たさなければ即中断する。
const allowedTestHosts = new Set(["localhost", "127.0.0.1", "db"]);
if (!allowedTestHosts.has(target.hostname)) {
  console.error(
    `[test-db] 危険な設定を検出: DATABASE_URL の接続先ホストが "${target.hostname}" です。\n` +
      `  テスト実行はローカル/Docker内のテスト専用DB（localhost・127.0.0.1・db のいずれか）に対してのみ許可されます。\n` +
      `  本番やクラウド上のDB（Neon等）に対して pretest（マイグレーション適用）や jest の resetDb()（全テーブルTRUNCATE）が\n` +
      `  実行されるのを防ぐためのガードです。backend/.env.test の DATABASE_URL を確認してください。\n` +
      `  正しい設定例: postgresql://user:pass@localhost:5433/sailvlog_test`
  );
  process.exit(1);
}
if (!dbName || dbName === "postgres" || !dbName.endsWith("_test")) {
  console.error(
    `[test-db] 危険な設定を検出: DATABASE_URL が "${dbName || "(空)"}" を指しています。\n` +
      `  テスト専用DBであることが名前からも分かるよう、DB名は "_test" で終わる必要があります。\n` +
      `  正しい設定例: postgresql://user:pass@localhost:5433/sailvlog_test`
  );
  process.exit(1);
}

const adminUrl = new URL(testUrl);
adminUrl.pathname = "/postgres";

async function main() {
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`[test-db] created database "${dbName}"`);
  } catch (err) {
    if (err && err.code === "42P04") {
      console.log(`[test-db] database "${dbName}" already exists — skip create`);
    } else {
      throw err;
    }
  } finally {
    await client.end();
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}

main().catch((err) => {
  console.error("[test-db] setup failed:", err);
  process.exit(1);
});
