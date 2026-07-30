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

// qa-engineer (T-90 flaky調査, 2026-07-28): 「t01-frozen-routes.test.tsがフルスイート実行時のみ
// 不定期に1件失敗する」を再現・特定した根本原因。
//
// routes/public.tsのGET /api/public/sessions/:slugは、閲覧数(publicViewCount)加算を
// 「レスポンスをブロックしないベストエフォート」としてawaitせずfire-and-forgetしている
// （`prisma.session.update(...).catch(() => undefined)`、意図的な設計・本番として正しい）。
// --runInBand下でも、このawaitされないPromiseは次のテストファイルの実行開始まで
// 「実行中」のまま残り得る。次のテストの直前にsetupFilesAfterEnv(resetDbHook.ts)の
// beforeEachが本関数を呼びTRUNCATE TABLE ... CASCADEを発行すると、
// 「まだ実行中のUPDATE(前のテストのPrismaClient/コネクション)」と
// 「TRUNCATE(次のテストの新しいPrismaClient/コネクション)」が異なるコネクションから
// 同時にテーブルへロックを要求し、Postgres側でロック順序が食い違ってデッドロックする。
//
// 実際に`npm test`を合計40回以上連続実行して直接観測した実エラー(t01実行時に発生した例):
//   PrismaClientKnownRequestError: Raw query failed. Code: `40P01`.
//   ERROR: deadlock detected
//   DETAIL: Process 19225 waits for AccessExclusiveLock on relation 26916 ...
//     blocked by process 19187. Process 19187 waits for RowShareLock on
//     relation 26584 ...; blocked by process 19225.
// このデッドロックの「被害者」としてPostgres自身がどちらかのトランザクションを強制中断するため、
// たまたまその瞬間に実行中だった**無関係などのテストファイルのDBアクセスでも**失敗しうる
// （t01に限らずt31/t100/t12/t30/t15/t95等、フルスイート実行時に観測した多様な失敗箇所と一致する）。
// 単独ファイル実行(`npx jest t01-frozen-routes --runInBand`)で再現しないのは、
// 前段の「別ファイルの残存Promise」が存在しないため。
//
// デッドロック(SQLSTATE 40P01)はPostgres自身が「これは一時的な競合で、リトライすれば
// 通常は成功する」と明示しているエラークラスであり、公式にもリトライが標準的な対処とされる
// （本番コード側のfire-and-forget設計を崩す必要はない。TRUNCATE=テスト専用の管理操作側で
// 吸収するのが正しい層）。よって本関数だけをデッドロック時に再試行する。
const DEADLOCK_SQLSTATE = "40P01";
const MAX_TRUNCATE_ATTEMPTS = 5;

function isDeadlockError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes(DEADLOCK_SQLSTATE) || /deadlock detected/i.test(err.message);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resetDb(): Promise<void> {
  assertSafeToTruncate();

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations')
  `;
  if (tables.length === 0) return;
  const identifiers = tables.map((t) => `"${t.tablename}"`).join(", ");
  const sql = `TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE;`;

  for (let attempt = 1; attempt <= MAX_TRUNCATE_ATTEMPTS; attempt++) {
    try {
      await prisma.$executeRawUnsafe(sql);
      return;
    } catch (err) {
      if (!isDeadlockError(err) || attempt === MAX_TRUNCATE_ATTEMPTS) throw err;
      // 相手側(前のテストの残存fire-and-forget書き込み)がすぐ終わるのを待ってから再試行する。
      // ランダム化するのは、複数のTRUNCATEが同時に再試行して再度衝突する確率を下げるため。
      await sleep(20 + Math.random() * 60);
    }
  }
}
