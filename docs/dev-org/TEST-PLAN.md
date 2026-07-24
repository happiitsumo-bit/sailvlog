# TEST-PLAN — sailvlog v3（レースリプレイ・デバッガ）

<!-- 契約: 作成者 qa-engineer / 入力: ARCH.md §4・TASKS.md T-90 / 出力先: implementer, Team Lead（Quality Gate） -->
<!-- 目的: カバレッジ%ではなく「PRDのMVP機能が壊れたら必ず検知できるか」で層と対象を決める -->

## 1. 方針（何をどの層でテストするか）

| 層 | 対象 | ツール | 量産しない理由 |
|---|---|---|---|
| ユニット | `frontend/src/lib/gpx/`（T-11）: パース・1Hz正規化・境界値 | Vitest（jsdom環境。DOMParser使用のため） | 純関数なので最も安く多くのケースを潰せる層。ここに厚く投資する |
| API（結合） | `backend/src/routes/`（T-01/T-12/T-15）: 認可・バリデーション・CRUD | Jest + Supertest（実DBはNeon同等のPostgres、docker-compose上のsailvlog_test） | HTTP層まで含めた契約（ARCH §4）はユニットだけでは保証できない。ただしDBは実物を使い、モックで「動いたことにしない」 |
| E2E | 「取込→複数艇再生→注釈→部内共有」の縦1本（S1完了条件） | **自動化しない。手動チェックリスト**（TASKS.md T-17/T-23/T-25に記録欄あり） | 再生エンジンはCanvas直描き＋rAFで自動テストの費用対効果が低い（描画の正しさをDOM/スナップショットで測れない）。MVPはS規模のため、1〜2本の手動シナリオで足りると判断（原則5「S規模では割り切る」）。**この判断は明示記録＝本ファイルがその記録** |

**カバレッジの数え方をしない。** 「半年後に黙って壊れたら困るか」で対象を選ぶ＝PRDのMVP経路（取込・再生・共有）とARCH §4のバリデーション全数値。UIの見た目（CSS等）はテスト対象外。

## 2. MVP機能 → テスト 対応表

| PRD/ARCHの機能 | 該当タスク | テスト | ファイル | 状態(2026-07-24時点) |
|---|---|---|---|---|
| 凍結ルートが410、存続ルートは200 | T-01 | supertestスモーク | `backend/src/__tests__/t01-frozen-routes.test.ts`（implementer作成） | 実装済・PASS |
| Session/Track/Annotationスキーマの整合 | T-10 | create/readスモーク | `backend/src/__tests__/t10-session-track-annotation.test.ts`（implementer作成） | 実装済・PASS |
| GPXパース＋1Hz正規化の境界値（正常6艇/欠測ギャップ/時刻逆転拒否/属性欠落拒否/startSecオフセット） | T-11 | ユニット（Vitest） | `frontend/src/lib/gpx/__tests__/normalize.todo.test.ts` + フィクスチャ`frontend/src/lib/gpx/__fixtures__/*.gpx` | **todoスキャフォールドのみ**。T-11のモジュール実装待ち |
| セッションAPI: 作成/取得/更新/削除・認可(401/403/TeamMember) | T-12 | supertest | `backend/src/__tests__/sessions-api.todo.test.ts` | **todoスキャフォールドのみ**。T-12実装待ち |
| セッションAPI: gridJson構造検証（lat/lon範囲・配列長一致・gaps境界・容量上限） | T-12, ARCH §4 | supertest（`fixtures/trackPayloads.ts`のビルダーで全境界を送る） | 同上 + `backend/src/__tests__/fixtures/trackPayloads.ts` | ビルダーは実装済・**呼び出し側テストはtodo** |
| 注釈CRUD・tSec範囲・body長・認可 | T-15 | supertest | `sessions-api.todo.test.ts`内（分離ファイル化はT-15着手時に検討） | todo |
| 取込→複数艇再生→注釈→URL共有→別ユーザー閲覧（S1縦1本） | T-13〜T-17 | **手動チェックリスト（自動化しない）** | TASKS.md T-17の検証欄に記録 | 未実施（T-17未着手） |
| クリーン環境セットアップ（README手順） | T-91と共同 | 手動1回 | 本ファイル §4 | 未実施（T-02完了後に実施） |

**運用ルール**: T-11/T-12/T-15が実装され次第、対応する`*.todo.test.ts`の`test.todo(...)`を実`test(...)`に差し替える。todoのまま放置して「テストがある体」にしない（deliverables原則「実行していないテスト結果の報告」禁止）。

## 3. テスト基盤

- **フレームワーク**: backend = Jest + ts-jest + Supertest（implementerがT-01のverification目的で先に導入済み。qa-engineerはVitestを提案していたが、二重ツール化を避けるため既存選択に合流した）。frontend(lib/gpx) = Vitest（jsdom環境。Next.js本体には影響しない独立ツール）
- **テストDB**: docker-composeの`db`サービス（ホスト`localhost:5433`）に対し、開発用`sailvlog_db`とは別に`sailvlog_test`を用意。
  - `backend/.env.test` にテスト専用の`DATABASE_URL`等を定義
  - `npm test`実行時に`pretest`フックが`backend/scripts/ensure-test-db.js`を自動実行: DBが無ければ作成 → `prisma migrate deploy`で最新migrationを適用
  - 各テストの`beforeEach`で全テーブルを`TRUNCATE ... RESTART IDENTITY CASCADE`（`backend/src/__tests__/helpers/resetDb.ts`）。テーブル一覧は`pg_tables`から動的取得するため、T-10以降でモデルが増えても変更不要
  - CIでは同じ`.env.test`定義（`localhost:5433`）に合わせてpostgres serviceのポートを5433にマッピングし、ローカルと同一の設定で動かす
- **実行コマンド**（README未反映。T-91で正式反映予定。それまでの一次情報はここ）:
  - backend: `cd backend && npm test`（DB作成・migrate・truncateまで自動）
  - frontend(lib/gpx): `cd frontend && npm test`

## 4. クリーン環境検証（人力・1回。T-02完了後に実施予定）

- 手順: 新規ディレクトリに`git clone`→ READMEの起動手順のみに従う→ `docker compose up`→ ログイン→チームページ表示まで到達できるかを記録
- 記録先: 本ファイルに追記（結果: 成功/失敗、所要時間、詰まった箇所）
- **未実施（2026-07-24時点）**: T-02（0円ホスティング疎通）がまだ完了していないため。T-02完了後にqa-engineerが実施し追記する

## 5. Codexへの委譲判断（現時点）

現時点では委譲対象なし。以下に該当したらTeam Leadへ提案する:
- T-11実装後、既存の大量の実データGPX（部内の実練習ログ）に対する網羅的な後付けテストが必要になった場合（量産系）
- 再生エンジン(lib/replay)のパフォーマンス回帰が疑われるがqa-engineerの診断で原因特定できない場合（セカンドオピニオン）

## 6. 発見事項・implementerへの申し送り

- `Session.visibility`フィールド（`@default("team")`）がARCH.md §3のスキーマ定義には無いが、実装では追加されている（`docs/dev-org/PRD-rev4-sharing-layer.md`の前方互換対応と思われる）。スコープ外の可能性があるため、architect/Team Leadでの追認要否を確認してください（qa-engineerからは指摘のみ。実装修正はしません）
- T-11（`frontend/src/lib/gpx/`）着手時は、本ファイルの`__tests__/normalize.todo.test.ts`と`__fixtures__/*.gpx`をそのまま使えます。フィクスチャの命名・意図はテストファイル冒頭のコメント参照
- T-12着手時は`backend/src/__tests__/fixtures/trackPayloads.ts`のビルダーをそのまま使えます（ARCH §4の数値境界を1関数=1違反でカバー済み）
