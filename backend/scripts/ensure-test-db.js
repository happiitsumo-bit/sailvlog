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

dotenv.config({ path: path.resolve(__dirname, "../.env.test") });

const testUrl = process.env.DATABASE_URL;
if (!testUrl) {
  console.error("[test-db] .env.test に DATABASE_URL がありません");
  process.exit(1);
}

const target = new URL(testUrl);
const dbName = target.pathname.replace(/^\//, "");
if (!dbName || dbName === "postgres") {
  console.error(`[test-db] 危険な設定を検出: DATABASE_URL が "${dbName}" を指しています。専用のテストDB名にしてください。`);
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
