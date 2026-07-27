// qa-engineer (T-90): テスト間のDB状態を分離するためのユーティリティ。
// public スキーマの全テーブル(_prisma_migrationsを除く)をTRUNCATEする。
// モデル一覧をハードコードしないので、T-10でSession/Track/Annotationが増えても変更不要。
import prisma from "../../database";

// B-01修正（2026-07-27, REVIEW-backend-2.md）: env.ts(override:true)・ensure-test-db.js(ホスト/DB名ガード)
// の2層に続く3層目の防御。「TRUNCATEを実行する直前」に接続先を再検査する。env.ts や pretest が
// 何らかの理由で迂回された場合（例: 個別にjestを直接起動しsetupFilesが効かない事故等）でも、
// この関数自身が「本番/非テストDBに対してTRUNCATEしようとしていないか」を最後の砦として確認する。
const allowedTestHosts = new Set(["localhost", "127.0.0.1", "db"]);

function assertSafeToTruncate(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("[resetDb] DATABASE_URL が設定されていません。TRUNCATEを中止します。");
  }
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!allowedTestHosts.has(parsed.hostname)) {
    throw new Error(
      `[resetDb] 危険な接続先を検出: ホスト "${parsed.hostname}" はテスト専用ホスト（localhost/127.0.0.1/db）ではありません。` +
        " 本番/非テストDBへのTRUNCATEを防ぐため中止します。backend/.env.test の DATABASE_URL を確認してください。"
    );
  }
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `[resetDb] 危険な接続先を検出: DB名 "${dbName}" が "_test" で終わっていません。` +
        " テスト専用DBであることが名前から確認できないため、TRUNCATEを中止します。"
    );
  }
}

export async function resetDb(): Promise<void> {
  assertSafeToTruncate();

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations')
  `;
  if (tables.length === 0) return;
  const identifiers = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE;`);
}
