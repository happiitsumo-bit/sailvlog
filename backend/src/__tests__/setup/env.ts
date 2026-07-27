// qa-engineer (T-90): jestのsetupFiles。テストファイル(index.ts等)がimportされるより前に
// .env.test を読み込み、process.env に DATABASE_URL 等のテスト用値を設定する。
//
// 実装ルールB-01修正（2026-07-27）: 以前は `override: false`（既定）で呼んでいたため、
// シェルに `DATABASE_URL` 等が既にexportされている場合（例: 本番デプロイ作業中に
// `export DATABASE_URL=<Neon本番URL>` した直後のシェルで `npm test` を叩く）、
// dotenv は「既に設定済みの値」を尊重してしまい、.env.test の値で上書きされない。
// その結果、本番DBに対して pretest の migrate や resetDb() のTRUNCATEが実行され得る
// （REVIEW-backend-2.md B-01）。テスト実行時は常に .env.test を正とすべきなので、
// `override: true` にしてシェル由来の値より確実に勝たせる。
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env.test"), override: true });
