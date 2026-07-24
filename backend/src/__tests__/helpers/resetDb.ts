// qa-engineer (T-90): テスト間のDB状態を分離するためのユーティリティ。
// public スキーマの全テーブル(_prisma_migrationsを除く)をTRUNCATEする。
// モデル一覧をハードコードしないので、T-10でSession/Track/Annotationが増えても変更不要。
import prisma from "../../database";

export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations')
  `;
  if (tables.length === 0) return;
  const identifiers = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE;`);
}
