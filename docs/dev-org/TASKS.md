# TASKS — sailvlog v3（レースリプレイ・デバッガ E2本線）

<!-- 契約: 作成者 architect / 入力: ARCH.md / 実行者: implementer, qa-engineer -->
<!-- タスクの粒度: 1タスク = 1コミット〜1PR相当。半日を超えるタスクは分割する -->

> **用語（Codex指摘対応 2026-07-24）**: 本ファイルの実装単位は **実装スライス S0〜S3** と呼ぶ。PRD.md の「Phase 1/2」は**プロダクト展開フェーズ**（Phase 1=MVP 8週間、Phase 2=A接続・他大学展開）であり、別概念。本ファイル内で「Phase」と書くときは必ず「PRDのPhase」と明示する。

## ブロッカー（人間/外部待ち。タスクではないが着手条件になる）

| ID | 内容 | 待ち先 | ブロックする対象 |
|---|---|---|---|
| B-1 | **主役確定サブゲート**（詳細は下記セクション。2週間並行検証 → 判定記入で完了） | オーナー＋Team Lead | S1以降の〔E2〕タスク全部。**S0〔共通〕はブロックされない** |
| B-2 | **スマホ実機計測**（手順: `spike/README.md`。基準: 30fps/シーク1s/ロード5s/クラッシュなし）。**2026-07-25 Team Lead waive済み**（S2.5冒頭のwaive記録参照。解除条件=B-3完了後にオーナー同席で実機計測） | オーナー | T-25（スマホ閲覧調整）と**S1完了判定**。FAIL時はADR-001の縮退策をS2に積み直す |
| B-3 | Neon / Render / Vercel の無料アカウント作成 | オーナー（数分） | T-02 |

〔共通〕= A主役に転んでも必要 /〔E2〕= E2主役確定後にのみ着手。

### B-1: 主役確定サブゲート（GATES ①条件付きGOの残条件。①判定=2026-07-23では**未解決**）

- [x] **解決（2026-07-24・オーナー裁定による方式変更）。** オーナーが「1週間で設計・完成」の目標を新たに設定し、選択肢「E2確定・即実装（検証は並走参考化）」を明示選択した（AskUserQuestion回答）。これによりB-1は**実装ゲートではなくなり**、2週間並行検証は「主役を決める関所」から「使われ方を測る並走計測」に格下げ。VALIDATION.mdは実施する場合の参考データ収集として有効。
- 記入欄:
  - A検証（Googleフォームでカード運用）の計測結果: （並走参考化。実施時に記入）
  - E2検証（練習2回のスマホGPS収録＋既製ツールで反省会1回）の計測結果: （並走参考化。実施時に記入）
  - 判定: **E2主役**（検証によらずオーナー裁定）
  - オーナー確認（氏名/手段）: オーナー本人／セッション内AskUserQuestion回答 ／ 日付: 2026-07-24
- 判定後の分岐手順:
  - **E2主役確定** → S1着手を解禁（このチェックボックスを✅にして記入欄を埋める）
  - **A主役転向** → ①進行中の〔E2〕タスクを即時停止 → ②PRD rev.1のAスコープでARCH.md/TASKS.mdを改訂 → ③②Architecture Gateを**再判定**（改訂版で通過するまで実装再開しない）。〔共通〕成果（T-01/T-02）はA主役でもそのまま有効
  - **両FAIL** → GATES ①の条件どおりPRDへ差し戻し。T-01はrevert手順（T-01欄に記載）で復旧可能

## タスク一覧

### S0（実装スライス0）: 〔共通〕基盤整理（B-1の検証待ち期間に消化する。主役がどちらでも無駄にならない）

- [x] T-01: 凍結ルートの無効化〔共通〕
  - 成果物: `backend/src/index.ts` で凍結対象（articles/likes/bookmarks/comments/follows/tags/questions/posts/courses/reference系）のルータ登録を410 Goneハンドラに置換。auth/users/boat-types/teams/sailorsは存続。フロントの凍結ページ（articles/questions/feed/learn/reference等）へのナビリンクを除去
  - **可逆な準備作業に限定**（Team Lead着手承認 2026-07-24。GATES ①通過前の製品変更であるため）: ルート登録の解除のみを行い、**DBスキーマ・データには一切触れない**。変更は**1コミット**にまとめ、`git revert`で完全に戻せること。**両FAIL時の復旧手順: 該当コミットを `git revert` して再デプロイ（これで凍結前の全ルートが復活する）**
  - 検証: 凍結エンドポイントがcurlで410を返し、`POST /api/auth/login`・`GET /api/teams` が200のまま。この2系統のsupertestスモークテストを新設して通す
  - **検証結果（2026-07-24）**: curl実測 — `/api/articles`,`/api/tags`,`/api/bookmarks`,`/api/questions`,`/api/posts`,`/api/courses`,`POST /api/users/:u/follow` 全て410。`POST /api/auth/login`は既存ユーザーで401(想定どおり)・新規register→loginで200/201。`GET /api/teams`は200。supertest `backend/src/__tests__/t01-frozen-routes.test.ts` 9件全PASS（`docker compose exec backend npx jest t01-frozen-routes`）。フロントNavbar/TopBarの「Feed/Q&A/Learn」ナビリンクと「Write(→/articles/new)」ボタンを除去（凍結ページ自体は残置・res.ok判定で本文表示済みのコンポーネントはグレースフルデグレード確認のみで未改変）
  - 依存: なし
- [ ] T-02: 0円ホスティング疎通〔共通〕
  - 成果物: Neon(DB)＋Render(Express/Docker)＋Vercel(Next.js)へ現行アプリをデプロイ。`.env.example` 整備、CORS_ORIGIN・JWT_EXPIRES_IN=2h 設定、migration実行
  - 検証: 公開URLでログイン→チームページ表示がEnd-to-Endで通る（スマホ回線からも確認）。cold start復帰時間を1回記録
  - 依存: T-01, B-3
  - **進捗（2026-07-27・オーナー本人が着手。Team Lead記録）**: B-3のうち **Neonのアカウント作成とDB作成は完了**（接続文字列取得済み）。Renderでbackendのデプロイを試行したが**3回とも失敗し、T-02は未完了のまま**。waiveは解除していない（公開URLでのE2Eは未達）。判明した原因と対処:
    1. **Branchが `main` のままだった**（`29e684d`＝ピボット前）→ `v3/replay-mvp` を指定する必要がある。新規サービス作成時に既定へ戻るため2回踏んだ
    2. **Dockerfileがリポジトリ直下に無い**（モノレポ）→ Render の **Root Directory を `backend`** にする。`backend/Dockerfile` は `COPY package*.json ./` を行うためビルドコンテキストも `backend/` に寄せる必要がある
    3. **`npm run build`（tsc）が失敗**。`src/routes/auth.ts` の `jwt.sign` で型エラー。@types/jsonwebtoken 9系が `expiresIn` を `number | StringValue` で受けるため環境変数由来の素の `string` を渡せない。**コミット `309b035` で修正済み**
  - **副産物（本タスクの最大の収穫）**: 上記3の根本原因は **backendのCIに型チェックもビルドも無かったこと**。`ts-node-dev --transpile-only` も `ts-jest`(isolatedModules) も型検査を行わないため、**型エラーを検出する経路がどこにも存在しなかった**（frontendジョブには `tsc --noEmit`/`build`/`test` が揃っていた）。`.github/workflows/test.yml` のbackendジョブに `tsc --noEmit` と `npm run build` を追加して塞いだ（`309b035`）
  - **未実施・次回の着手条件**: ①Renderの設定（Branch=`v3/replay-mvp` / Root Directory=`backend` / Auto-Deploy=**Off**）②環境変数の投入（`DATABASE_URL` は **`-pooler` を除いた直結URL**。プール経由だとmigrationが失敗するため）③`prisma migrate deploy` を**ローカルから**実行（本番イメージは `npm install --omit=dev` で `prisma` CLI が入らないためRender上では実行不可）④Vercel未着手
  - **安全上の注意（2026-07-27・REVIEW-backend-2 B-01）**: マイグレーション実行時に `export DATABASE_URL=<本番>` を**使わないこと**。テスト用の `.env.test` はシェルの既存環境変数を上書きしないため、同じシェルで `npm test` を叩くと本番DBが全テーブルTRUNCATEされる。コマンド単位（`DATABASE_URL="..." npx prisma migrate deploy`）で渡す

### S1: 〔E2〕縦貫通 — 「GPX取込→複数艇再生→注釈→部内共有」の動く最小版（着手条件: B-1サブゲートでE2確定）

- [x] T-10: Prismaスキーマ追加（Session/Track/Annotation）
  - 成果物: ARCH.md §3どおりのmigration（純追加）。User/Teamへのリレーション追記
  - 検証: `prisma migrate dev` 成功＋既存テーブルに変更が出ないことをmigration SQL目視確認＋seedスクリプトで3モデルのcreate/read
  - **検証結果（2026-07-24）**: `docker compose exec backend npx prisma migrate dev --name add_session_track_annotation` 成功。migration.sql目視確認=CREATE TABLE/CreateIndex/AddForeignKeyのみでALTER/DROPなし（既存15モデル無変更）。`Session.visibility String @default("team")`をTeam Lead指示どおり追加（Annotationには追加せず）。jestテスト`t10-session-track-annotation.test.ts`で3モデルcreate/read+visibilityデフォルト値をPASS確認
  - 依存: なし（T-01/02と並行可）
- [x] T-11: GPXパース＋1Hzグリッド正規化モジュール（`frontend/src/lib/gpx/`）
  - 成果物: DOMParserでtrkpt/time抽出→共通1Hzグリッドへ線形補間リサンプリング→gaps検出、の純関数群。SPIKE-01の合成GPX（`spike/gpx/`）をテストフィクスチャに流用
  - 検証: ユニットテスト（正常系6艇・欠測ギャップ・時刻逆転/属性欠落GPXの拒否・startSecオフセット計算）が通る
  - **検証結果（2026-07-24）**: `parseGpx`/`normalizeToGrid`/`computeSessionStart`を`frontend/src/lib/gpx/parse.ts`に実装（qa-engineer用意のfixture `__fixtures__/*.gpx` を流用）。Vitest（jsdom環境）10件全PASS: 正常系6艇・startSecオフセット5s/10s・欠測ギャップgaps=[[4,6]]検出＋補間・時刻逆転拒否・属性欠落拒否・壊れたXML拒否・エッジケース(trkpt0件拒否/1点のみ)・gridJson長一致。実行: `docker compose exec frontend npx vitest run src/lib/gpx`
  - 依存: なし
- [x] T-12: セッションAPI（Express）
  - 成果物: ARCH.md §4のうち**セッション/トラック系エンドポイント**（POST/GET/PATCH/DELETE sessions、POST tracks、GET tracks/:id/gpx）＋`requireTeamMember`ミドルウェア＋サーバ側構造検証。GET /:id はrawGpx除外・gzip。**注釈エンドポイント（annotations系）は本タスクの対象外＝T-15の担当**
  - 検証: supertest（作成→track投稿→取得→非メンバー403→削除権限403/204、バリデーション400系）が通る。構造検証はARCH.md §4の定義どおり: `gridJson.lat.length === gridJson.lon.length === pointCount` を検証し、**gapsは点列と長さを揃えない別配列**として各要素`[start,end]`の境界（`0 ≦ start ≦ end < pointCount`）を別途検証するテストを含む
  - **検証結果（2026-07-24）**: `backend/src/routes/sessions.ts`（POST/GET一覧/GET詳細/PATCH/DELETE/POST tracks）＋`backend/src/routes/tracks.ts`（GET :id/gpx）＋`middleware/requireTeamMember.ts`＋`lib/validateTrackPayload.ts`を実装。express.jsonのlimitを`/api/sessions`・`/api/tracks`のみ8mbに拡張（他ルートは変更なし）。qa-engineer用意の`fixtures/trackPayloads.ts`をそのまま使い`t12-sessions-api.test.ts`で25件全PASS（作成/一覧/詳細/更新/削除の認可、lat・lon範囲外、length不一致、gaps境界（start負・end超過・start>end・境界ぎりぎり201）、duration超過、gridJson2MB超/rawGpx5MB超→413、非TeamMember403、未認証401）。バックエンド全体`docker compose exec backend npx jest`= 5 suites / 36 passed + 27 todo（qa側todo）。追加でcurl手動確認: register→session作成→track投稿→GET詳細(gridJson込み・rawGpx除外)→GPXダウンロード→DELETE(204)の一連が通ることを確認（テスト後にデータはクリーンアップ済み）
  - **仕様上の補足**: `type`はPrismaで`@default(practice)`のため必須項目リストから除外（省略可）。gridJson/rawGpxのサイズ超過は`durationSec超過`より優先して413を返すよう順序を決定（両方に該当する場合の判定を一意にするため）
  - 依存: T-10
- [x] T-13: 取込ウィザードUI（`/sessions/new`）
  - 成果物: 複数GPXファイル選択→lib/gpxで正規化→重ね描き簡易プレビュー（Canvas静止画で可）→艇ラベル入力→Session+Tracks保存
  - 検証: 手動: 合成GPX6本を取り込み、DB保存後 `/sessions` 一覧に出る。壊れたGPXでエラーメッセージが出て保存されない
  - **検証結果（2026-07-24）**: `frontend/src/app/sessions/new/page.tsx`（ウィザード本体）＋`SessionPreviewCanvas.tsx`（重ね描き静止画プレビュー、lib/replayとは別実装）を実装。lib/gpx（T-11）の`parseGpx`/`computeSessionStart`/`normalizeToGrid`をそのまま利用し、ファイル単位でパース失敗を検知してエラー表示（該当ファイルのみエラー表示・保存ボタンは全体を無効化＝壊れたGPXが1本でもあれば保存されない）。T-12のAPI契約どおり`POST /api/sessions`→各艇`POST /api/sessions/:id/tracks`の順で保存し、成功後`/sessions?teamId=`へ遷移。T-13検証で要求される一覧確認のため、範囲内の最小ページとして`/sessions`（一覧）も同時に実装（ARCH.md §4のフロント主要ページ一覧に記載済みのページ）。teamIdはGET /api/teams（既存公開エンドポイント）から選択する方式（「自分のチーム」を返す専用APIが存在しないため。questions/newのboatType選択と同じパターン）。**この環境にDocker/PostgreSQLが無くbackendコンテナ（DNS名`backend`）に到達できないため、ブラウザでの実POST（DB書き込み込み）のE2E手動確認は実施不可**。実施した検証: ①`npx tsc --noEmit`エラー0 ②`npm run build`成功（`/sessions`, `/sessions/new`とも生成される動的ルートとして出力を確認） ③既存`npx vitest run`（lib/gpx T-11テスト10件）全PASS＝回帰なし ④一時テスト（コミット対象外・実行後削除）でqa-engineer用意の6艇fixture（`__fixtures__/boat1〜6_clean*.gpx`）を実際に`parseGpx`→`computeSessionStart`→`normalizeToGrid`に通し、ウィザードと同じ計算（durationSec=18、6グリッドとも`lat.length===lon.length===pointCount`）が成立することを確認。**DB書き込みを伴うE2E（GPX取込→`/sessions`一覧表示→壊れたGPXでの保存拒否の実ブラウザ確認）はCIで検証**（GitHub ActionsでのDocker+Postgres環境が前提。T-90でCI構築時にこのシナリオのE2Eテストを含めることを推奨）
  - 依存: T-11, T-12
- [x] T-14: 再生エンジン＋再生ページ（`/sessions/[id]`）
  - 成果物: `lib/replay/`（ReplayClock: rAF+ref／CanvasRenderer: ローカル平面投影・艇マーカー・テール・スケールバー）＋再生/一時停止/1x/4x/8x/シークバー/艇の表示切替UI（UI同期≦10Hz）。SPIKE-01は参照のみ・コピー禁止
  - 検証: 合成6艇セッションでPC実測: 60fps近傍（DevToolsで確認）・シーク体感即応・gaps区間が破線表示。数値はTASKS追記欄に記録
  - **検証結果（2026-07-24）**: `frontend/src/lib/replay/`（`geo.ts`=投影＋gaps判定の純関数、`ReplayClock.ts`=rAF+ref時刻管理、`CanvasRenderer.ts`=命令的描画、いずれも新規実装・spike/はコード参照のみで未コピー）＋`frontend/src/app/sessions/[id]/page.tsx`（再生ページ）を実装。UIパネル同期はrAFループ内で100ms間隔（=10Hz）に間引き、シーク操作のみ即時反映。
    - ①ユニットテスト: `t14-replay-engine.test.ts`（computeProjection/project/isIndexInGap/splitByGapRuns の純関数11件＋ReplayClockのplay/pause/speed/clamp/自動停止）全PASS（`npx vitest run`）
    - ②`npx tsc --noEmit`エラー0・`npm run build`成功（`/sessions/[id]`が動的ルートとして生成される）
    - ③**実ブラウザでの性能実測**: この環境にDocker/PostgreSQLが無くbackendに接続できないため、SPIKE-01のgen-gpx.js（使い捨てスクリプト、コピー不可の対象外＝データ生成のみでロジックは含まない）で実規模データ（2時間・1Hz・6艇・7200点/艇、うち1艇に30秒ギャップ2箇所）を生成し、T-11の本番`parseGpx`/`normalizeToGrid`で正規化した上で使い捨てのモックAPIサーバ（Node標準httpのみ・新規依存なし・コミット対象外）に載せ、Playwright（環境にプリインストール済み）で`/sessions/[id]`を実ブラウザ（Headless Chromium）で操作して計測。結果: 再生中のrAFフレーム間隔が1x/4x/8xいずれもp50=p95=16.7ms・平均60.0fps（ディスプレイ同期16.7msに張り付き＝描画コストがフレーム予算に対して無視できるレベル。SPIKE-01のPC実測=render p95 0.2msと整合）。シーク応答（値変更→2rAF後の再描画完了まで）は17〜31ms（4サンプル、目標「シーク1秒以内」に対し十分高速）。gaps区間の破線表示はスクリーンショット（ズーム）で目視確認済み（艇3・tSec=1810=gap[1800,1829]内で実線→破線への切り替わりを確認）。console errorは1件（`ERR_CONNECTION_RESET`、モックサーバ未提供の付随リソース起因と推定・再生ロジックと無関係）
    - 艇の表示切替（チェックボックスでON/OFF）・シークバー・速度切替(1x/4x/8x)は同スクリーンショット/操作で動作確認済み
  - 依存: T-12（T-13と並行可。seedデータで先行開発）
- [x] T-15: タイムライン注釈（API＋UI）
  - 成果物: **注釈CRUD API（POST /api/sessions/:id/annotations、PATCH/DELETE /api/annotations/:id。本タスクが唯一の担当）**＋再生ページのタイムラインピン表示・現在時刻で追加（tSec自動キャプチャ、艇はタップで任意付与）・ピンクリックでシーク・一覧サイドパネル
  - 検証: supertest（権限含む）＋手動: 注釈追加→リロード後も表示→ピンからシーク
  - **検証結果（2026-07-24）**: `backend/src/lib/validateAnnotationPayload.ts`（tSec∈[0,durationSec]・body≦2000字の構造検証）＋`backend/src/routes/sessions.ts`に`POST /:id/annotations`追加＋新規`backend/src/routes/annotations.ts`（`PATCH/DELETE /api/annotations/:id`、author本人 or Team adminのみ＝`requireTeamMember.ts`に追加した`isAuthorOrTeamAdmin`で判定）。フロントは`frontend/src/app/sessions/[id]/page.tsx`にタイムラインピン（シークバー直下、`tSec/durationSec`の位置にクリック可能な丸ボタン、クリックでシーク）・現在時刻に注釈追加するフォーム（艇の任意紐付けはタップ操作ではなくプルダウン選択に簡略化＝UI実装上の裁定で、ARCH変更ではない）・注釈一覧サイドパネル（クリックでシーク）を追加。
    - **この環境に実はPostgreSQLがローカルインストール済み（apt: postgresql-16、Docker不要）と判明** — サービス起動（`service postgresql start`）→`sailvlog_user`ロール作成→`.env.test`のDATABASE_URLをポート5432に向けて`npm test`を実行し、**モックなしの実DB統合テスト**でT-12〜T-15を再検証: `backend/src/__tests__/t15-annotations-api.test.ts`（新規12件: 正常系201・tSec範囲外400・body超過400・非TeamMember403・未認証401・他セッションtrackId400・author本人PATCH200・Team adminPATCH200・非author非adminPATCH403・author本人DELETE204(カスケード確認)・非author非adminDELETE403・存在しないID404）を含むbackend全体`npm test -- --runInBand`が **6 suites / 48 passed(todoの27件を除く全件)/ 0 failed** で通ることを確認（実行ログはこのコミット時点で確認済み。再現手順は発見事項に記録）
    - フロント側は`npx tsc --noEmit`エラー0・`npm run build`成功（`/sessions/[id]`にピン/フォーム/一覧の分だけバンドルサイズ増加を確認、機能追加以外の異常なし）
    - 手動UIの実ブラウザE2E（注釈追加→リロード後も表示→ピンからシーク）は、検証中にセッションのワーカープロセスが再起動され一度中断したが、**T-16の検証時に同じ手順で再実施し完了**（`annotationVisibleAfterReload=true`。詳細はT-16の検証結果欄）
  - 依存: T-12, T-14

> **T-13/T-14/T-15 の完了取り消し（2026-07-25 §7再点検）**
> 完了マークは2026-07-24時点のもので、UI-DESIGN §7「実装時の必須修正」10項目（本ファイル注記7で完了条件に昇格したのは2026-07-25＝**マーク後**）に対する点検を経ていない。
> 実装コードを10項目に照らして再点検した結果は以下（2026-07-25時点の初回判定は**3件充足・7件未達**）のため、機能面のみの完了マークを取り消す。
>
> | # | §7項目 | 判定 | 根拠 |
> |---|---|---|---|
> | 1 | セッションカードのリンク化 | OK | `sessions/page.tsx` カード全体が`<Link>` |
> | 2 | モバイルDOM順 | **修正済（2026-07-26再点検でOK確認）** | `.replay-main`（canvas→再生コントロール→タイムライン→レグ）→`.replay-aside`（艇の表示→比較→反省メモ）のDOM順は既にb8a5150で成立済み（`.replay-layout`はflex縦積みでDOM順=表示順）。実装者2026-07-26が現状コードを再点検した結果、既に§4.6の要求順を満たしていることを確認、コード変更なし（T-25のアコーディオン化と合わせて再検証） |
> | 3 | スクラブのキーボード操作 | **修正済** | `input[type=range]`で操作可能だったが±1秒刻みだったため、←→=±5秒／Shift=±30秒を実装＋`aria-valuetext` |
> | 4 | ファイル入力 | **修正済** | 実`<input type="file">`＋`<label for>`はOK（a11yは充足）＋b8a5150で`/sessions/new`にドラッグ&ドロップの受け口（`onDrop`/`onDragOver`）を追加済み |
> | 5 | labelの関連付け | OK | `s-title`/`s-type`/`s-team`/`s-venue`/`s-gpx`に`htmlFor`、艇ラベルは`aria-label` |
> | 6 | ステータス通知 | **修正済** | `role`が1つも無く、共有失敗時に`window.prompt()`（ブロッキングダイアログ）を使っていた。`role="status"`/`role="alert"`へ置換し`prompt()`を撤去 |
> | 7 | 操作対象サイズ24px | **修正済** | 注釈ピンが8×8pxのまま。透明ヒット領域24×24pxに拡張＋`aria-label` |
> | 8 | 色以外の識別 | **修正済** | b8a5150で`BOAT_COLORS`を6色化（重複なし）＋`shortBoatLabel`による常時ラベル描画を追加（`setLineDash`はgaps表現専用のまま維持） |
> | 9 | ダークテーマのコントラスト | **修正済（2026-07-26確認）** | b8a5150で`--color-accent`のdark値を`#2f9fd1`(3.0:1)→`#177bae`(white-on-accent 4.69:1)へ是正済み（`frontend/src/app/globals.css:116`のコメントに算出根拠あり）。§7 #9が求めるDSトークン側の是正は完了 |
> | 10 | `<html lang="ja">` | **修正済** | `layout.tsx`が`lang="en"`のままだった |
>
> - 2026-07-25のコミットで修正したのは 3・6・7・10（検証: `npx tsc --noEmit`エラー0／`npx vitest run` 21件PASS／`npm run build`成功）。
> - 2026-07-25の別コミット（b8a5150・Team Lead退避コミット）で 4・8・9（本体）も解消済み（下記DS適用ログ・コミットメッセージ参照）。
> - **2026-07-26・implementer再点検で2も充足済みと確認**（コード変更なし。b8a5150時点の`.replay-layout`/`.replay-aside`構成が既に§4.6のDOM順を満たしていた）。
> - **10項目すべて充足を確認したため、下記「完了マーク復帰」でT-13/T-14/T-15を[x]に戻す。**
> - 未整備の検証手段: frontendに`@testing-library/react`が無く、a11y属性の回帰を自動で捕まえられない。導入をT-90（CI）に含める（未解消のまま。導入見送りの経緯はT-90検証結果欄参照）。
>
> **DS適用（2026-07-25・implementer/T-26と同時実施）**: `frontend/src/app/globals.css`の`:root`トークンをdesign-system/styles.css・theme.json準拠の値に差し替え（旧v1"Claude-paper"の変数名はDSトークンへのエイリアスとして残し、`.form-page`/`.container`/`.btn`等の既存クラスは無改造で配色だけ差替）。外部フォント読み込み（Google Fonts）を撤去しDS指定のシステムフォントスタックへ統一。`prefers-color-scheme`・`[data-theme]`によるダークテーマトークンを新規追加（旧globals.cssにはダークモードが存在しなかった）。`CanvasRenderer.ts`の`BOAT_COLORS`独自8色をDSの`--color-boat-1..4`（ダーク値）に統一しスケールバー色もDS水面上インク相当に変更。`sessions/[id]/page.tsx`のリプレイCanvas背景を生hex`#eef3f5`から`var(--gradient-water-deep)`に変更（UI-DESIGN §4「常時ダークな海図面」に一致）。`sessions/new/SessionPreviewCanvas.tsx`の同種の生hex背景・独自色もgetComputedStyle経由のDSトークン読み取りに変更（この画面は常時ダークではないためライト/ダーク双方に追従）。検証: `npx tsc --noEmit`エラー0／`npx vitest run`23件PASS／`npm run build`成功／`next start`+claude-in-chromeで`/login`・`/handbook`を実描画確認（DSアクセント色反映・コンソールエラー0件）。
>   - **§7 #9本体（accent色のコントラスト是正）は2026-07-25のb8a5150（Team Lead退避コミット）で解消**: `--color-accent`のdark値を`#2f9fd1`(3.0:1)→`#177bae`(white-on-accent 4.69:1)へ是正。上記表#9も修正済みへ更新済み。
>
> **完了マーク復帰（2026-07-26・implementer）**: 上記10項目の再点検により**全10項目が充足**（1/3/5/6/7/10は従来通りOK・2/4/8/9は本セッションで充足確認）したため、T-13/T-14/T-15の完了マークを`[x]`に戻す。根拠の対応関係:
> - 項目2（モバイルDOM順）: 2026-07-25時点のb8a5150で既に成立していたコードを2026-07-26に再点検してOK確認（コード変更なし）
> - 項目4（ファイル入力＝ドロップゾーン）・8（色以外の識別＝6色+常時ラベル）・9（ダークコントラスト＝accent是正）: いずれも2026-07-25 b8a5150で実装済みだったが55fps実測未了で退避コミットのまま検証が止まっていたため、本タスク（T-20 fps実測・T-25モバイル対応）と合わせて2026-07-26に動作・数値を実測して確認
> - T-13の成果物（取込ウィザード）はb8a5150による変更を含まないため、2026-07-24検証結果がそのまま有効
> - T-14（再生エンジン・55fps系）は本ファイル下部T-20欄の2026-07-26 fps実測（実DB+実ブラウザ）で再確認
> - T-15（注釈CRUD＋UI）はT-16検証時の実DB E2E（2026-07-24, `annotationVisibleAfterReload=true`）がそのまま有効、UI a11y部分（role/24pxタップ等）は上記表の3・6・7で充足確認済み

- [x] T-16: 部内共有の仕上げ（URLクエリ最小＋認可確認）
  - 成果物: `?t=&boats=` の読み書き（一時停止/シーク確定時のみreplaceState）。共有ボタン（現URLコピー）
  - 検証: 別ユーザー（同Team）でURLを開くと同じ時刻・同じ艇選択で再現。非メンバーは403画面
  - **検証結果（2026-07-24）**: `/sessions/[id]`に`?t=&boats=`の読み書きを実装。書き込みは一時停止時（togglePlay内）とシーク確定時（シークバーのmouseup/touchend/keyup、および注釈ピン・注釈一覧クリックのような単発シーク）のみ`history.replaceState`する（再生中のrAFループでは書かない）。読み込みは初回データ取得時に1回だけ`useSearchParams()`から`t`/`boats`を読み、ReplayClockの初期シーク位置と艇の初期表示集合に反映（値が無い/不正なら全艇表示・t=0にフォールバック）。共有ボタンは`navigator.clipboard.writeText`で現在URLをコピーし「URLをコピーしました」を2秒表示。非メンバーのアクセスは既存のGET /api/sessions/:idの403（`requireSessionTeamMember`）をそのままエラーメッセージ付きの専用画面（「閲覧できません」＋理由文＋Sessionsへ戻る）として表示するよう改善。
    - **発見事項に記録した手順で実backend(Postgres実DB)+実frontendを起動し、Playwrightで3ユーザー(uploader/同Teamの別メンバー/非メンバー)を使い分けた実ブラウザE2Eを完走**（前回セッション再起動で中断した分の埋め合わせも兼ねる）。確認できた結果:
      - T-13: 壊れたGPXを混在させると取り込むボタンが無効化（`submitDisabledWithBadFile=true`）、除去すると有効化・保存後`/sessions`一覧に表示
      - T-14: 再生ボタンクリックで一時停止/再生ラベルが切り替わる（実際に再生ループが動作）
      - T-15: 注釈追加→即座に表示→**ページリロード後も表示**（`annotationVisibleAfterReload=true`）→タイムラインピンクリックでシーク動作
      - T-16: 艇を1つ非表示にしてシークバーをドラッグ確定 → URLが`?t=5&boats=35,36`のように更新 → 共有ボタンでクリップボードにも同じURLがコピーされる(`clipboardMatchesUrl=true`) → **同Teamの別ユーザーが同じURLを開くと`00:00:05 / 00:00:18`・チェック済み艇2/3で完全再現**（`user2_timeLabel`/`user2_checkedBoats`で確認） → **非メンバーが同じURLを開くと「閲覧できません / このチームのメンバーではありません」画面が出る**（`outsiderSeesAccessDenied=true`、スクリーンショットで目視確認も実施）
    - フロントは`npx tsc --noEmit`エラー0・`npm run build`成功
  - 依存: T-15
- [ ] T-17: S1 E2Eスモーク＋デプロイ反映 — **ここで「動く最小版」完成**
  - 成果物: 本番URL上で「取込→複数艇再生→注釈→URL共有→別ユーザー閲覧」を通しで実施した記録（スクリーンショット付きでこのファイルに追記）
  - 検証: 上記通し＋Renderのcold start込みで初回表示が実用に耐えることを確認。B-2（スマホ実機）の結果もここまでに回収
  - 依存: T-13, T-16, T-02

### S2: 〔E2〕MVP完成（PRD §5の残項目）

- [x] T-20: 2艇比較ハイライト
  - 成果物: 2艇を選ぶと他艇が減光・選択艇が強調（**間隔距離(m)のライブ表示はMVPから除外**=Codexレビュー2026-07-24のYAGNI指摘採用。PRD §5の要件は「2艇ハイライト比較」のみで距離表示は含まない。反省会で距離の需要が実証されたら将来タスクとして起票）
  - 検証: **6艇合成GPXフィクスチャ**（SPIKE-01流用）で2艇の選択/解除を切り替えながら再生し、**PCでChrome DevTools Performanceパネル計測により55fps以上を維持**すること。計測値をこのファイルに追記
  - **検証結果（2026-07-26）**: 描画側の強調/減光ロジック（alpha・lineWidth・markerRadius）はb8a5150で実装済み（`t20-boat-identification.test.ts`にBOAT_COLORS/shortBoatLabelの回帰テストあり）。本タスクで残っていた**55fps実測**を実施。
    - 手順: この環境で稼働中の`docker-compose`（実Postgres＋実backend＋実frontend、ports: backend 8001/frontend 3001）に対し、ユーザー登録＋既存T10テストチームへの`TeamMember`直接INSERT（`docker compose exec db psql`、teamId=1・role=admin）でログイン可能な状態を作成。`spike/gen-gpx.js`で生成した6艇×7200点(2h・1Hz)の実規模GPXを、`npx --yes playwright`（プロジェクトに新規依存追加はせずnpxのキャッシュ経由。ブラウザバイナリは`npx playwright install chromium`で取得）経由の実ブラウザ操作で`/sessions/new`から**実際にアップロード**→保存→`/sessions/[id]`（実データ・実backend、モックなし）で2艇を「比較する2艇」チェックボックスでON/OFFを切り替えながら1x/4x/8xそれぞれ3秒間rAFフレーム間隔を計測。
    - 結果: 1x = 181frames/3s・平均60.06fps・p95フレーム間隔17.3ms（p95fps 57.8）／4x = 181frames・平均60.18fps・p95 17.3ms（57.8fps）／8x = 181frames・平均60.15fps・p95 17.5ms（57.1fps）。**いずれも要求の55fps以上を満たす**（p95ベースで57.1〜57.8fps）。スクリーンショットで比較選択(2/2)状態のハイライト/減光を目視確認済み。
    - 使い捨てスクリプト（コミット対象外・scratchpadに保存）: `measure-t20.js`。テストデータ（`T20 fps計測用セッション`のSession/Track、docker-compose開発DB内）は削除せず残置（他実装者のT-26時の残置テストユーザーと同様、実害なし・記録のみ）。
  - 依存: T-14
- [ ] T-21: レグ頭出し（RQ-10: マーク指定→共通境界算出＋手動補正）
  - 成果物: マップ上でマーク座標を手動指定→基準艇の最近傍通過時刻からSession.legsを自動算出→タイムライン上で境界を手動ドラッグ補正→レグジャンプボタン＋`?leg=`対応（境界算出アルゴリズムの詳細はRQ-10「方向decided・詳細保留」につき本タスク実装時に確定。仮定が崩れたらRESEARCH.md §4経由で再調査）
  - 検証: 合成GPX（タックパターン既知）でL1境界が期待時刻±60s内に出る簡易テスト＋手動補正が保存される
  - 依存: T-16
- [x] T-22: 収録ハンドブックページ
  - 成果物: `/handbook`（静的1ページ）: Geo Tracker設定手順（記録間隔最短・バックグラウンド許可）・出艇前チェックリスト・GPX取り出し方・「反省会前にURLを開いておく」（cold start対策）・「1Hz GPXが出せる手段なら何でも可」の注記
  - 検証: オーナーが読んで手順どおりに1回収録できる（並行検証の実手順と共用）
  - **検証結果（2026-07-24）**: `frontend/src/app/handbook/page.tsx`を実装。内容はVALIDATION.md §2-1（記録手段比較）・§2-2（収録手順書）を踏襲し、要求された5項目（Geo Tracker設定・出艇前チェックリスト・GPX取り出し方・cold start対策・1Hz GPXが出せる手段なら何でも可の注記）＋着艇後の手順・sailvlogへの取込手順を追加。既存の記事詳細ページと同じ`react-markdown`+`markdown-body`（新規npm依存なし・既存devependency流用）で描画し、デザインシステムと統一。ログイン不要（マネ艇担当がアカウントを持たない場合でも閲覧できるようにする判断。ARCH/PRDに反しない範囲のUI裁定）。`npx tsc --noEmit`エラー0・`npm run build`成功。Playwrightでスクリーンショットを撮り、チェックリスト・コードスパン・リンクが意図通り描画されることを目視確認済み
    - 「オーナーが読んで手順どおりに1回収録できる」の最終確認は人間の実施が前提の検証項目のため、オーナー本人による実地確認は未実施（内容の正確性はVALIDATION.mdの一次調査に基づく。実際に使ってみて分かりにくい点があれば追記が必要）
  - 依存: なし（S1と並行可）
- [ ] T-23: シードコンテンツ投入
  - 成果物: 自部の実練習1〜2本を本番へ取込み。実データで表示品質（GPSノイズ・タック視認性）を確認
  - 検証: 反省会で1回実使用し、フィードバックを「発見事項」に記録。ノイズでタック議論が困難なら「表示用スムージング」を将来→今回へ昇格判断（Team Lead協議）
  - 依存: T-17, 実データ（並行検証の収録物を流用可）
- [ ] T-24: JSONB応答の実測ガード（RQ-05・RESEARCH.md §3.6②）
  - 成果物: 実データセッションで `GET /api/sessions/:id`（6艇）の応答時間をNeon本番相手に10回計測し、結果をこのファイルに追記
  - 検証: p95 < 1s → PASSで閉じる。FAIL → ADR-002の縮退（rawGpxのbytea+gzip化 or gridJson分割）を新タスク起票
  - 依存: T-23
- [x] T-26: v2フロント画面の削除（オーナー裁定 2026-07-25・PRD §5「v2フロント画面の扱い」）
  - 成果物: 凍結済みv2画面（articles/questions/feed/learn/reference等のページ・専用コンポーネント・navigation設定・検索UI）をフロントから削除。ログイン/登録は存続（遷移先を`/sessions`へ変更・UI-DESIGN §1）。layout.tsxの説明文言とmetadata・`<html lang="ja">`をv3の実態に更新
  - 前提: **削除前にアーカイブブランチ `archive/v2-frontend` が存在すること**（バックアップはgitブランチ。裁定は「隠す」でも「即削除」でもなく「ブランチ保存の上で削除」）
  - 検証: `npm run build` 成功＋残存ページから削除ページへのリンク切れゼロ（grepでhref確認）＋ログイン→/sessions遷移がE2Eで通る
  - **検証結果（2026-07-25）**: `articles/questions/feed/learn/reference/boat/tag/teams/sailors/users`の全ページ・専用コンポーネント（ArticleCard/BookmarkButton/LikeButton/IntelligenceFeed/PickUpReference/ReferenceCard/ReferenceSidebar/RelatedReferences/ClassFocusTile/ClassFlag/ClassSidebar/RightSidebar/CommandPalette/CommandPaletteProvider/未使用だった旧Navbar/SkeletonCard）・検索UI・`lib/mock-references.ts`を削除（`archive/v2-frontend`へ退避済みの内容と同一。前提のアーカイブブランチは`git branch`で存在確認済み、作り直していない）。ログイン/登録は存続し成功後の遷移先を`/sessions`へ変更（UI-DESIGN §1）。ルート`/`はv2 Bentoホームを廃し、ログイン状態で`/sessions`or`/login`へ振り分ける入口に縮小。layout.tsxのmetadata（title/description）とナビ（Sessions/Handbookの2項目）を更新、`<html lang="ja">`は既存のまま維持。TopBarは検索コマンドパレットを除去しログアウトボタンに変更。login/register未対応だった§7 #5(label htmlFor)・#6(role="alert")もあわせて適用。
    - ①`npx tsc --noEmit`エラー0 ②`npx vitest run`23件PASS（回帰なし、T-11/T-14のテストのみで元々v2ページのテストは無かった） ③`npm run build`成功、ルートが19→8（`/`, `/_not-found`, `/handbook`, `/login`, `/register`, `/sessions`, `/sessions/[id]`, `/sessions/new`）に縮小 ④`grep -rn 'href="/\(articles\|questions\|feed\|learn\|reference\|boat\|tag\|teams\|sailors\|users\)'` 0件（削除ページへのリンク切れなし） ⑤**ログイン→/sessions遷移の実E2E**: この環境はDocker Desktopが稼働しておりdocker-compose（`sailvlog-frontend-1`/`sailvlog-backend-1`/`sailvlog-db-1`、bind mountでホストの変更を即反映）が別セッションにより起動済みだったため、それをそのまま使い実ブラウザ（claude-in-chrome）で検証: `POST /api/auth/register`でテストユーザー作成→`/login`で実際にフォーム入力しログインボタンをクリック→URLが`http://localhost:3001/sessions`へ遷移し、Sessionsページ（チーム選択・Import GPXボタン）が表示されることを確認（`/sessions`の認証ガードがログイン失敗時は`/login`へ即戻す実装のため、遷移が保持された時点でログイン成功も確認済み）
  - 依存: T-13, T-14（/sessionsが存在しない状態で消すと空アプリになるため）
  - **完了マーク補完（2026-07-27・routine）**: 上記2026-07-25検証結果に対しチェックボックスが未更新のまま残っていたのを発見。`REVIEW.md`（R-01・R-11・スコープ逸脱確認の各所）が独立してT-26完了を既成事実として扱っている（`/teams`等の削除・globals.css死んだCSSの対応済みページ範囲・チームページ/個人プロフィール不在の確認）ため、追加検証なしで完了マークのみ[x]に補完。
- [x] T-25: スマホ閲覧調整
  - 成果物: 再生ページのレスポンシブ対応（縦画面レイアウト・タッチシーク）。B-2の結果がFAILならADR-001縮退策①〜③を適用
  - 検証: オーナーのスマホ実機で30fps以上・操作可能（B-2と同基準）
  - **検証結果（2026-07-26）**: **B-2（オーナー実機計測）はTeam Lead waive済み**（本ファイル冒頭ブロッカー欄参照）のため、実機の代わりにPlaywrightのモバイルviewportエミュレーション（`devices['iPhone 13']`、390×844、タッチ有効）で代替計測した。**実機計測は未実施（B-2待ち）**。
    - 実装: ①UI-DESIGN §4.6のとおり「比較する2艇」「反省メモ」パネルを`<details>`アコーディオン化し、マウント時に`window.matchMedia("(max-width: 860px)")`が真の場合のみ初期状態を閉に設定（デスクトップは従来どおり常時展開・挙動変更なし）。②Canvas上の左右スワイプで±5秒シーク（`frontend/src/lib/replay/touchSeek.ts`に`computeSwipeSeekStepSec`/`clampSeekTarget`を純関数として切り出し、`t25-touch-seek.test.ts`で7件のユニットテストを追加）。③レグチップ行を横スクロール化（`.replay-legs-row`、`navbar-row-bottom`と同じ`overflow-x:auto`パターン）。
    - モバイルviewport計測（390×844・iPhone 13エミュレーション、実機ではない）: ①DOM順スクリーンショットで「Canvas→再生コントロール→タイムライン→レグ→艇の表示→比較(折りたたみ)→反省メモ(折りたたみ)」の順を確認（`t25-mobile-top.png`/`t25-mobile-full.png`）。②アコーディオン初期状態=両方とも`open:false`を`details.replay-accordion`のDOM属性で確認、`summary`タップで開閉することも確認。③Canvas上でのtouchstart/touchend（右方向40px）でシークバーの値が`0→5`（+5秒）へ変化することを確認。④再生中のrAFフレーム間隔計測（1x・3秒間）=181frames・平均60.19fps・p95フレーム間隔17.6ms（p95fps 56.8）。**このマシン上のヘッドレスChromium・エミュレーションでの数値であり実機の30fps基準の代替指標**（同一PC上の計測なのでT-20の数値と近いのは想定どおり。実機での挙動はB-3解除後の実機計測で別途確認する必要あり）。
    - 使い捨てスクリプト（コミット対象外）: `measure-t25.js`。
  - 依存: T-17, B-2（waive済み・上記参照）
- [x] T-27: 6艇識別ルール裁定（ARCH ADR-008）のフォローアップ — 艇色トークンの同期ガードテスト＋コード内根拠コメントの更新
  - 背景: ③Quality Gateで「UI-DESIGN §4.2（4色＋破線）vs 実装（6色＋常時ラベル）」の食い違いを architect が裁定し、**実装側を正**とした（ARCH ADR-008・UI-DESIGN rev.6）。機能実装の変更は**不要**（現行`CanvasRenderer.ts`はADR-008準拠）。残るのは正本間のドリフト防止
  - 成果物: ①`frontend/src/lib/replay/__tests__/t20-boat-identification.test.ts` に「`BOAT_COLORS` が `design-system/theme.json` の `color.sailvlog.boats.dark` と完全一致する」テストを追加（theme.jsonを直接importして突き合わせる。現行テストは6色・重複なしの検算のみで、トークン正本とのドリフトを捕まえられない=REVIEW.md R-12と同型の弱点）②`CanvasRenderer.ts` 冒頭コメント（8〜15行目）の根拠引用を「Team Lead指摘」からARCH ADR-008へ更新し、「setLineDashはgaps専用」の記述にADR-008参照を追記（コード変更は**コメントのみ**。BOAT_COLORSの値・ロジックは変更しない）
  - 検証: `npx vitest run` 全件PASS（新テスト含む）。theme.json側の艇色を1色変えるとテストが落ちることを一時変更で確認してから戻す
  - **検証結果（2026-07-26実施・2026-07-27 architect監査で完了マーク補完）**: コミット `41608db` で成果物①②とも実施済みを確認（①t20テストがtheme.jsonを直接import・②CanvasRenderer.ts冒頭コメントがADR-008を正本として引用、いずれも現行コードで確認）。theme.json側を1色変えてテストが落ちることの一時変更確認もコミットメッセージに記録済み。architect監査時に `npx vitest run` を再実行し **6 files / 55 passed**（同期ガードテスト含む全PASS）を実測。チェックボックスだけが未更新だったため補完
  - 依存: なし（frontend単独・小タスク。backend並行作業と競合しない）
- [ ] T-28: 部内セッションAPIの応答select化 — `publicViewCount` の全経路除外（2026-07-27 architect監査で起票。REVIEW.md R-02の残り半分）
  - 背景: ARCH §3は `publicViewCount` を「**APIにも画面にも出さない**」と定めるが、R-02対応（2026-07-26）は Team Lead指示により `GET /api/sessions/:id` のみ除外した。**`GET /api/sessions`（一覧）・`POST /api/sessions`・`PATCH /api/sessions/:id`・`POST /:id/unpublish` 直前の update 戻り値経由の各レスポンスには現在も含まれている**（`findMany`/`create`/`update` がselect無しで全カラム返却のため。qa-engineerが `t97` で一覧経路の漏洩を意図的FAILテストとして固定済み=コミット `cfcc65c`）
  - 成果物: ①`backend/src/routes/sessions.ts` の一覧/作成/更新（および必要なら unpublish）のレスポンスを明示的な `select`（またはレスポンス直前の除外）に変更し、`publicViewCount` をどの部内レスポンスにも含めない。R-02提案どおり「含めるものだけ列挙」を部内APIにも適用するのが望ましい ②**（architect裁定 2026-07-27）** qa-engineer報告（T-90検証結果末尾）の `GET /api/teams/:slug/articles`・`GET /api/teams/:slug/questions` は**410凍結にする**（認証必須化ではなく）。根拠: これらは凍結機能（Article/Question=ADR-003）のコンテンツ列挙であり、機能単位の凍結方針に従うのが一貫する。ADR-009（認証必須化）の対象は「v3でも現用する閲覧系」のみ
  - 検証: `t97` の意図的FAILテストがPASSに転じる＋一覧/作成/更新レスポンスに `publicViewCount` キー非含有のテストを整備＋`/api/teams/:slug/articles`・`/:slug/questions` が410を返すテスト（`t01-frozen-routes` に追加が自然）。backend全テストグリーン
  - 依存: なし（backend単独。実装は implementer 担当 — architectはコード変更しない）
- [ ] T-29: 公開ビュー系フロントの残Major対応〔Codex担当・③Quality Gate再判定の解除条件〕（2026-07-27 architect監査で起票。GATES ③の未解消3件をタスク台帳へ正式登録）
  - 成果物: ①**R-03フロント半分**: `frontend/src/lib/publicSession.ts` のサーバー側fetchに `x-internal-proxy-secret` ヘッダを同送（値は環境変数 `INTERNAL_PROXY_SECRET`。**NEXT_PUBLIC_ プレフィックス禁止**。ヘッダ仕様の正本は `backend/src/routes/public.ts` 冒頭コメント＝ARCH ADR-010） ②**R-05**: 公開中セッションへのトラック追加・公開済み注釈の編集時に警告＋明示確認（「このセッションは公開中です。追加した航跡もすぐ外から見えます」。Team Lead裁定=案A・フロントのみ、backend変更なし） ③**R-06**: `fetchPublicSession` のステータス区別 — 404のみ `notFound()`、429/5xx/ネットワーク例外は「一時的に表示できません」の再試行案内（存在の秘匿と障害の秘匿を混ぜない） ④付随: `frontend/src/lib/teamRole.ts` 冒頭コメントの「既存の一般公開エンドポイント」記述をADR-009（認証必須化済み）に合わせて更新（コメントのみ）
  - 検証: ①docker-composeで `INTERNAL_PROXY_SECRET` 一致時に転送IPが別バケット扱いになること（既存 `t31` ④-b系テストの前提が実通信で成立） ②公開中セッションでのトラック追加時に確認UIが出ること（手動/Playwright） ③backendを止めた状態・429状態で `/p/[slug]` が404でなくエラー案内を表示すること
  - 依存: T-31（backend側は実装済み）。**着手・完了の判定はTeam Lead（③Quality Gate再判定の入力）**

### S2.5: 〔共有1〕公開昇格＋限定公開URL＋OGP（PRD rev.6でPhase 1へ前倒し。仕様=`SPEC-share1-phase1.md`・設計=ADR-007）

> **着手条件（厳守）: S1・S2の全タスク（T-10〜T-17、T-20〜T-25）が完了していること。** 本スライスはPRDのゲートを意図的に1段飛ばして前倒ししたものであり（PRD rev.6・第6リスク）、**前倒し着手＝スコープ膨張の顕在化**とみなす。着手条件を満たさないまま手を付けたくなった時点で、共有1をPhase 2へ差し戻す判断をTeam Leadに上げること。
>
> **【Team Lead waive 記録 2026-07-25】** 上記手順どおりTeam Leadからオーナーへ判断を上げ、**「デプロイ以外の完了でwaiveして着手」をオーナーが選択**（セッション内AskUserQuestion回答）。
> - **waive対象**: T-02・T-17（デプロイ）／T-23（実練習データ投入）／T-24（Neon実測）／T-25の実機計測部分（B-2）
> - **理由**: いずれも**B-3（Neon/Render/Vercelのアカウント未作成）と実艇練習という外部・人間依存**であり、コードで閉じられない。スコープ膨張（作る物が増える方向の逸脱）ではなく、**外形要因による完了判定の不能**である点が防波堤の想定した危険と質的に異なる
> - **維持する防波堤**: §S2.5「作らないもの」リスト（実装ルール8）は**一切緩めない**。T-25のレスポンシブ実装自体は実施する（実機計測のみ保留）
> - **解除条件**: B-3完了後、オーナー同席でT-02→T-17→T-23→T-24を実施し、本waiveを消す
>
> **作らないもの（`SPEC-share1-phase1.md` §3.2。実装ルール3と同格の禁止事項）**: フォロー／フィード／いいね／公開側コメント／公開セッションの一覧・検索・タグ／チームページ・個人プロフィール／アカウント登録導線／閲覧数のUI表示／動的OG画像生成。**提案も不要。**

- [x] T-30: 公開昇格のスキーマ＋API〔共有1〕
  - 成果物: Prisma純追加migration（Session: `publicSlug`/`learningSummary`/`publishedAt`/`publishedById`/`publicViewCount`、Annotation: `isPublic`。ARCH §3のとおり既存カラムは一切変更しない）＋`POST /api/sessions/:id/publish`＋`POST /api/sessions/:id/unpublish`。権限は**uploader本人 or Team admin**（既存 `isAuthorOrTeamAdmin` と同じ判定系を流用）。スラッグは `crypto.randomBytes(9).toString("base64url")`（Node標準・新規依存なし）
  - 検証: supertest — 昇格201系（unlisted/public）／要約が空・401字以上で400／visibility不正で400／他セッションの注釈IDを混ぜたら400／非uploader・非adminで403／unpublish後に`publicSlug`がnullになる／再公開で**前と異なるスラッグ**が発行される。migration SQLを目視し既存テーブルへのALTERがADD COLUMNのみであることを確認
  - **検証結果（2026-07-25）**: `backend/prisma/schema.prisma`にSession（publicSlug/learningSummary/publishedAt/publishedById/publishedBy/publicViewCount）とAnnotation（isPublic）を純追加し、`npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel`でSQL生成→`migrations/20260725075822_add_publish_fields/migration.sql`として保存→`prisma migrate deploy`で開発DB(sailvlog_db)・テストDB(sailvlog_test)両方へ適用（`prisma migrate dev`はこの環境が非対話のため`Error: non-interactive`で使えず、diff→deploy方式に切替。T-10/T-12との整合は保たれている）。**migration SQL目視確認**: `ALTER TABLE ... ADD COLUMN`（Annotation.isPublic、Session 5列）＋`CREATE UNIQUE INDEX Session_publicSlug_key`＋`ALTER TABLE ... ADD CONSTRAINT`（新規FK）のみ。既存カラムのALTER/DROPはゼロ。`backend/src/lib/validatePublishPayload.ts`（visibility∈{unlisted,public}・learningSummary 1〜400字・publicAnnotationIds整数配列）＋`backend/src/routes/sessions.ts`に`POST /:id/publish`（`requireSessionTeamMember`+`isUploaderOrTeamAdmin`で権限判定→他セッション注釈ID混入を`prisma.annotation.count`で検出→400→スラッグ発行(衝突時最大5回再試行)→`$transaction`でSession更新＋Annotation.isPublicを一旦全false→選択分のみtrue）＋`POST /:id/unpublish`（publicSlug=null・publishedAt=null・visibility="team"）を実装。publicUrlは新規env変数を足さず既存`CORS_ORIGIN`先頭値を流用。`backend/src/__tests__/t30-publish-api.test.ts`（新規14件: unlisted/public正常系・要約空400・要約401字400・visibility不正400・他セッション注釈ID混入400・非uploader非admin403・Team admin200・選択注釈のみisPublic=true・未認証401・存在しないID404・unpublish後publicSlug null・再公開で別スラッグ・非uploader非adminのunpublish403）を実DB（`docker compose exec backend npx jest t30-publish-api --runInBand`）で実行し**14/14 PASS**。backend全体`docker compose exec backend npx jest --runInBand`= **7 suites / 62 passed（todo27件除く）/ 0 failed**（回帰なし）。`npx tsc --noEmit`は既存の`auth.ts`型エラー2件のみ（T-30変更ファイルに起因するエラーはゼロ、既知の既存課題）
  - 依存: T-15（Annotation）、MVP完了（上記着手条件）
- [x] T-31: 公開取得API＋漏洩防止テスト〔共有1〕 — **本スライスの安全性の要**
  - 成果物: `GET /api/public/sessions/:slug`（認証不要）の**専用ホワイトリスト・シリアライザ**（既存 `GET /api/sessions/:id` の整形を流用しない＝ADR-007）＋一律404（存在しない/非公開/取り消し済みを区別しない）＋IPあたり60req/minの簡易レート制限（メモリ内カウンタ・新規npm依存なし）＋`publicViewCount` の加算（同一IP・同一スラッグは5分に1回まで）＋`GET /api/tracks/:id/gpx` を未認証では404にする
  - 検証: supertest — ①**禁止キー非含有テスト**（レスポンスJSONを再帰走査し `rawGpx`/`email`/`teamId`/`notes`/`publicViewCount` が**どの階層にも存在しない**ことを検証）②`isPublic=false` の注釈が件数ごと出ない ③非公開セッションのスラッグ相当値・存在しないスラッグ・unpublish後がすべて404で**レスポンスボディが同一** ④レート制限が61回目で429 ⑤未認証の `/api/tracks/:id/gpx` が404
  - **検証結果（2026-07-25）**: `backend/src/lib/serializePublicSession.ts`（含めるものだけを列挙するホワイトリスト整形。session={id,title,type,startedAt,durationSec,venue,learningSummary,legs,visibility,publishedAt,team:{name}}／tracks={id,boatLabel,startSec,pointCount,gridJson,sourceApp}(rawGpxはPrisma `select`自体に含めずSELECT時点で除外)／annotations={id,tSec,trackId,legIndex,body}(呼び出し側で`isPublic:true`のみDBクエリで絞り込み済み)。session.notes/marks・track.sessionId/createdAt・annotation.authorId/isPublic/createdAt・team.id・publicViewCountは意図的に非包含）＋`backend/src/lib/rateLimiter.ts`（IPごと固定60秒ウィンドウ・上限60reqのメモリ内カウンタ／同一IP・同一スラッグ5分間引きのビューカウント間引き。新規npm依存なし）＋`backend/src/routes/public.ts`（`GET /api/public/sessions/:slug`。`Session.visibility==="team"`または`publicSlug`不一致は一律404で同一ボディ、レート制限超過は429、閲覧カウントはベストエフォート非同期加算）＋`backend/src/middleware/auth.ts`に`authMiddlewareOr404`を追加し`backend/src/routes/tracks.ts`の`GET /:id/gpx`に適用（未認証=404、認証済み非TeamMemberは従来どおり403のまま据え置き）。
    - `backend/src/__tests__/t31-public-api.test.ts`（新規11件）を実DB（`docker compose exec backend npx jest t31-public-api --runInBand`）で実行し**11/11 PASS**。内訳: 公開セッション未認証200／**①禁止キー非含有（rawGpx/email/teamId/notes/publicViewCountを再帰走査で検証＋値としてのemail本文・notes本文・`<gpx>`断片も非含有を確認）**／②isPublic=falseの注釈2件が返らず本文も非露出／③存在しないスラッグ2種の404レスポンスボディが完全一致／③-b unpublish後(publicSlug=null)の404レスポンスボディが存在しないスラッグと完全一致／④同一IPからの61回目リクエストが429／publicViewCountが同一IP・同一スラッグ5分以内は2回叩いても+1のまま／publicViewCountがレスポンス非含有／⑤`GET /api/tracks/:id/gpx`未認証404／回帰確認: 認証済みTeamMemberは200でGPX本文取得・認証済み非TeamMemberは403のまま変化なし。
    - backend全体`docker compose exec backend npx jest --runInBand`= **8 suites / 73 passed（todo27件除く）/ 0 failed**（T-30含め回帰なし）。`npx tsc --noEmit`は既存の`auth.ts`型エラー2件のみ（T-31変更ファイル起因のエラーはゼロ）
    - **発見事項**: レート制限のIPキーは`req.ip`を使用（Renderの単一インスタンス前提・Express `trust proxy`未設定）。将来リバースプロキシ構成が変わる場合は`trust proxy`設定の見直しが必要になる可能性がある（現状のARCH.md/SPECの前提を超える変更のため実装者判断では対応せず記録のみ）
  - 依存: T-30
- [x] T-32: 昇格ダイアログUI〔共有1〕
  - 成果物: `/sessions/[id]` に「公開する」ボタン（権限保持者のみ描画）＋昇格ダイアログ（学びの要約テキストエリア＝残り文字数表示・必須／注釈チェックリスト＝**既定全オフ**＋「反省会のメモは既定で非公開です」の説明文／公開範囲ラジオ2択＋「リンクを知っている人は誰でも見られます」の明記／**「航跡の先頭・末尾に陸上の移動が含まれていないか確認してください」の注意書き**＝PRD第7リスク②）。公開済みは「公開URLをコピー」「公開をやめる」に切替。`/sessions` 一覧とリプレイ画面に「公開中」/「リンク限定」チップ
  - 検証: UI-DESIGN §7の10項目を満たす（label関連付け・`role="status"`・24pxタップ対象・`alert()`不使用）。手動: 非権限ユーザーにボタンが出ない／要約未入力で確定できない／既定でチェックが1つも入っていない
  - **検証結果（2026-07-26）**: 実装＝`frontend/src/lib/publish.ts`（純関数: `canManageSession`/`remainingSummaryChars`/`isSummaryValid`/`visibilityChipLabel`）＋`frontend/src/lib/teamRole.ts`（Team admin判定。backendに「自分のrole」専用APIが無いため既存の一般公開エンドポイント`GET /api/teams`→`GET /api/teams/:slug`を2段で叩く代替実装。uploader本人一致なら呼ばない設計でネットワーク往復を最小化）＋`frontend/src/components/PublishDialog.tsx`（昇格ダイアログ本体）＋`frontend/src/components/VisibilityChip.tsx`＋`/sessions/[id]/page.tsx`・`/sessions/page.tsx`へ統合。`frontend/src/lib/utils.ts`に`formatClockTime`を切り出し、`/sessions/[id]`の既存`formatTime`をこれに置換（重複実装を避け、後続T-33での再利用に備える＝ADR-007の再利用原則を時刻表示にも適用）。
    - **ユニットテスト**: `frontend/src/lib/__tests__/t32-publish.test.ts`（新規12件: canManageSession の未ログイン/uploader本人/Team admin/一般部員の4分岐、remainingSummaryChars、isSummaryValid の空・空白のみ・400字ちょうど・401字、visibilityChipLabel の public/unlisted/team）。`npx vitest run` = **6 files / 54 passed**（ベースライン42件を維持し、新規12件を追加。既存回帰なし）。
    - **`npx tsc --noEmit`**: エラー0。**`npm run build`**: `✓ Compiled successfully`、8ルート生成（`/p/[slug]`はT-33で追加予定のため未出現、既存8ルートは維持）。
    - **Playwright実DB検証**（`docker compose`稼働中のbackend/db/frontendに対し、`POST /api/auth/register`で新規ユーザー2名を作成→`TeamMember`をSQLで直接INSERT/UPDATE→localStorageにtoken/userをセットしてブラウザ操作。手順は2026-07-26付「発見事項」のMac版Playwright手順を使用）:
      1. **uploader本人でアクセス**: 「公開する」ボタンが表示された（`getByRole("button",{name:"公開する"})`で検出）
      2. **要約未入力では確定できない**: ダイアログの確定ボタンが`disabled=true`。入力後`disabled=false`に変化することも確認
      3. **注釈チェックは既定で全オフ**: 注釈2件中、いずれもチェックなしを確認（`isChecked()`が両方false）
      4. **1件選択してunlistedで公開→トースト・チップ・ボタン切替**: 公開後`role="status"`のトーストに「公開しました」を確認、`.visibility-chip`が「リンク限定」、ヘッダのボタンが「公開URLをコピー」に切替わったことを確認
      5. **`alert()`/`prompt()`不使用**: `page.on("dialog", ...)`でネイティブdialogイベントを監視し、公開・公開をやめる操作を通して**発火なし**を確認（確認ステップはインラインの`.dialog-confirm-card`で実装、`window.confirm()`は使っていない）
      6. **「公開をやめる」の確認文言**: 「公開URLは無効になります。もう一度公開すると新しいURLになります」を確認
      7. **権限マトリクスの3分岐を実データで確認**: ①uploader本人（userId=2）→ボタン表示 ②同チームの一般部員（role=member, userId=3, 非uploader）→ボタン**非表示**（`btnCount=0`） ③同じuserId=3を`TeamMember.role='admin'`にSQL更新→ボタン**表示**（`btnCount=1`、`fetchIsTeamAdmin`の非同期判定が反映されるまで1.5秒待機して確認）。3ケースとも期待どおり
      8. **`/sessions`一覧のチップ**: 公開後に`/sessions?teamId=1`を開き`.visibility-chip`のテキストが「リンク限定」であることを確認
      - 検証後、`POST /:id/unpublish`で該当セッションを`team`へ戻しテストデータをクリーンな状態に復元済み。使い捨てPlaywrightスクリプト（`t32-verify.js`/`t32-perm-check.js`/`t32-debug*.js`/`t32-list-check.js`）はscratchpad配下・コミット対象外
    - **発見事項**: バックエンドに「呼び出しユーザー自身のteam role」を1回で返す専用API（例: `GET /api/sessions/:id`のレスポンスに`myRole`を含める等）が無いため、Team admin判定は`GET /api/teams`→`GET /api/teams/:slug`の2段呼び出しで代替した（`frontend/src/lib/teamRole.ts`）。uploader本人のケースはこの往復が発生しないため実用上のコストは限定的だが、Team admin判定のたびに一覧+詳細の2リクエストが発生する点は将来「セッション詳細に自分のroleを含める」バックエンドAPI改修で解消できる（backend/はスコープ外のため実装せず記録のみ）。
  - 依存: T-30, UI-DESIGN rev.5 §5
- [x] T-33: 公開ビュー `/p/[slug]`〔共有1〕
  - 成果物: 認証不要の読み取り専用ページ。`lib/replay/` を**そのまま再利用**（描画コードを分岐も複製もしない）。学びの要約→Canvas→再生コントロール→タイムライン（公開注釈のみピン）→公開メモ一覧→「sailvlogとは」説明ブロックの順。編集系UI（メモ追加・公開ボタン・削除）は**描画しない**
  - 検証: 手動/E2E: ログアウト状態で開ける／非公開注釈がDOMにもレスポンスにも出ない／編集UIが存在しない／スマホ縦画面で崩れない
  - **検証結果（2026-07-26）**: 実装＝`frontend/src/lib/publicSession.ts`（サーバー側フェッチ。Docker内部の`API_URL`を使い分け、`cache:"no-store"`で取り消し直後の404切替を保証）＋`frontend/src/app/p/[slug]/page.tsx`（サーバーコンポーネント。404は`next/navigation`の`notFound()`で既存の共通`app/not-found.tsx`に委譲＝一律404の思想をフロントにも適用）＋`frontend/src/app/p/[slug]/PublicReplayView.tsx`（クライアントコンポーネント。`@/lib/replay`の`ReplayClock`/`computeProjection`/`renderFrame`/`BOAT_COLORS`を`/sessions/[id]`と全く同じ呼び出し方でそのまま再利用。比較強調は常に空集合を渡すことで機能自体を無効化、レグ表示・注釈追加・削除・公開ボタンは実装しない）。
    - **発見事項→その場で修正**: ルートlayout.tsx（`app/layout.tsx`）が全ページ共通で`<TopBar/>`（Login/Joinリンク）と`<BottomTabBar/>`（Sessions/Handbookタブ）を描画する構造だったため、そのままでは公開ビューにも部内ログイン導線・内部ナビゲーションが漏れ出す（UI-DESIGN §5.3「ログイン導線を強制しない」・SPEC §3.2に抵触）。ルート構成の大規模な作り直し（route group分割）はスコープが大きくなるため避け、`TopBar.tsx`/`BottomTabBar.tsx`（いずれも既に`"use client"`）に`usePathname()`で`/p/`始まりなら`null`を返す1行を追加する最小差分で解消（他ページの表示は無変更であることをPlaywrightで確認済み、下記参照）。
    - **`npx tsc --noEmit`**: エラー0。**`npm run build`**: `✓ Compiled successfully`、**9ルート**生成（`/p/[slug]`が新規追加され8→9。既存8ルートは変化なし）。**`npx vitest run`**: 6 files / **54 passed**（T-32時点から回帰なし。T-33は新規ロジック追加なしのため新規ユニットテストは無し＝UIの結合検証はPlaywrightで実施）。
    - **Playwright実DB検証**（`docker compose`稼働中backend/db/frontendに対し、T-32検証で作ったセッション(id=2, team=1)を再利用。トラック1艇・公開注釈1件(id=2「テスト注釈A」)・非公開注釈1件(id=3「テスト注釈B」)の状態で`POST /:id/publish`しunlisted URLを発行）:
      1. **ログアウト状態で開ける**: 新規ブラウザコンテキスト（localStorageにtoken/userを一切セットしない）から`/p/{slug}`にアクセスしHTTPステータス**200**を確認
      2. **DOM順**: `.container`直下の子要素を走査し `public-view-header → page-header → public-summary-card(学びの要約) → CANVAS → 再生コントロール(再生/速度ボタン) → タイムライン(input[range]) → 公開メモ一覧 → #public-about` の順を確認（UI-DESIGN §5.3のDOM順と一致）
      3. **非公開注釈がDOMにもレスポンスにも出ない**: `curl /api/public/sessions/:slug`のJSONに「テスト注釈B」が含まれないこと、ブラウザの`page.content()`（レンダリング後のHTML全文）にも「テスト注釈B」が含まれないことの両方を確認。公開注釈「テスト注釈A」は両方に存在
      4. **編集UIが存在しない**: 「現在時刻...に議論を残す」フォーム・「公開する」ボタン・「削除」ボタンがいずれも0件（`getByRole`/テキスト検索）
      5. **スマホ縦画面(390×844, iPhone 13相当)で崩れない**: `document.documentElement.scrollWidth > clientWidth`が`false`（横スクロールなし）をPlaywrightで確認、スクリーンショット`t33-mobile.png`（scratchpad・コミット対象外）で目視確認
      6. **ログイン導線・内部ナビゲーションの非表示**: `.app-topbar`・`.bottom-tab-bar`・「Login」リンクがいずれも0件であることを確認。同じPlaywrightセッションで`/login`へ遷移し`.app-topbar`が1件（＝他ページの表示は無変更）であることも確認し、修正が公開ビュー限定であることを担保
      7. **404の一律性**: 存在しないスラッグ`/p/does-not-exist-slug-xyz`が**404**（`curl -o /dev/null -w "%{http_code}"`）
      - 検証後、`POST /:id/unpublish`でテストセッションを`team`へ復元済み。使い捨てPlaywrightスクリプト（`t33-verify.js`/`t33-domorder.js`/`t33-chrome-check.js`/`t33-shot.js`）はscratchpad配下・コミット対象外
  - 依存: T-31, T-14（再生エンジン）
- [x] T-34: OGP＋公開E2E〔共有1〕 — **ここで共有1完成**
  - 成果物: `/p/[slug]` の `generateMetadata`（title・description=学びの要約冒頭100字・`og:image`=静的1枚・`unlisted` は `robots: noindex`）＋静的OG画像1枚（海図面＋ロゴ。動的生成はバックログ）
  - 検証: E2E通し — 部内で昇格 → ログアウト状態でURLを開く → 公開注釈のみ表示 → メタタグをHTMLで確認（`og:title`/`og:description`/`og:image`/`noindex`の有無が範囲で切り替わる） → 「公開をやめる」→ **同じURLが404** → 再公開で別URLが発行される。結果をこのファイルに追記
  - **検証結果（2026-07-26）**: 実装＝`frontend/src/app/p/[slug]/page.tsx`に`generateMetadata`を追加（title=`{セッション名} ｜ {チーム名} — sailvlog`、description=学びの要約冒頭100字、`openGraph`/`twitter`ともに`og:image`を出力、`visibility==="unlisted"`のときのみ`robots:{index:false,follow:false}`）＋`frontend/public/og-image.png`（1200×630静的画像。海図グリッド＋航跡風の折れ線＋「⛵ sailvlog」ロゴ＋サブタイトル。使い捨てのPlaywright+HTML合成で1枚だけ生成しコミット、動的OG画像生成は実装しない＝SPEC §3.2の禁止事項どおり）。
    - **発見事項→その場で修正（og:imageの絶対URL解決）**: 当初`next/metadata`の`metadataBase`（`app/layout.tsx`に追加）に委ねたところ、この環境のdocker-compose構成（`next dev`がコンテナ内部では3000番で待受け、公開ポートは3001番）で`og:image`が`http://localhost:3000/og-image.png`に解決され、外部からアクセス不能なURLになる実測不具合を確認（`metadataBase`の値を明示的に変えても反映されず、常に3000番になる＝Next.js側がdev時に内部ポートを優先する挙動と推測）。対応として、backendの`publicOrigin()`（T-30）と同じ発想で`frontend/src/app/p/[slug]/page.tsx`内に`siteOrigin()`ヘルパーを実装し、`NEXT_PUBLIC_SITE_URL`（未設定時`http://localhost:3001`）から`og:image`の絶対URLを明示的に組み立てる方式に変更。修正後`curl`で`http://localhost:3001/og-image.png`（正しい公開ポート）が解決されることを確認。本番（Vercel/Render）デプロイ時は`NEXT_PUBLIC_SITE_URL`に実ドメインを設定する必要がある（T-02/デプロイ設定側の作業。現状はwaive中のため未設定=ローカルfallback値のまま）。
    - **`npx tsc --noEmit`**: エラー0。**`npm run build`**: 9ルート（T-33から変化なし、`/p/[slug]`のサイズが4.3kBのまま）。**`npx vitest run`**: 6 files / **54 passed**（T-32/T-33から回帰なし。T-34はメタデータ出力のみで新規純関数ロジックなしのため新規ユニットテストは追加せず、E2Eで直接検証）。
    - **E2E通し検証（Playwright + `docker compose`稼働中の実backend/db/frontend、T-32/T-33で使ったセッションid=2を再利用）**:
      1. 部内ユーザー(uploader本人)として`POST /api/sessions/2/publish`でunlisted昇格 → `publicSlug`発行を確認
      2. ログアウト状態（token/userをセットしない新規ブラウザコンテキスト）で`/p/{slug}`を開き**HTTPステータス200**
      3. 公開注釈「テスト注釈A」はページ本文に含まれ、非公開注釈「テスト注釈B」は含まれないことを確認
      4. メタタグをレンダリング後HTMLから正規表現で検査: `og:title`/`og:description`/`og:image`が存在し、**unlistedでは`<meta name="robots" content="noindex...">`が存在**することを確認
      5. `POST /api/sessions/2/unpublish`で取り消し
      6. **同じURL(旧slug)が404**になることをPlaywrightの`page.goto()`のレスポンスステータスで確認
      7. `POST /api/sessions/2/publish`（今度は`visibility:"public"`）で再公開 → **旧slugとは異なる新slugが発行**されることを確認。新URLは200で開け、`visibility:"public"`のため**`noindex`が付与されない**ことも確認（unlisted/publicでのnoindex切替を実データで検証）
      8. 旧URL(手順1のslug)は再公開後も**引き続き404のまま**であることを確認（再公開が旧URLを復活させないことの確認。ADR-007「1方向昇格＝取り消し後は新スラッグ」の実データ検証）
      - 検証後、`POST /:id/unpublish`でテストセッションを`team`へ復元し、使い捨てPlaywrightスクリプト（`t34-e2e.js`、`og-source.html`/`og-shot.js`はog-image.png生成用）はscratchpad配下・コミット対象外
    - **これで共有1（公開昇格＋限定公開URL＋OGP）完成**。T-30〜T-34すべて完了。S2.5セクションの残タスクなし。
  - 依存: T-32, T-33

### S3: 仕上げ（③Quality / ④Demo Gate に向けて）

> **MVP完了集約条件（S3の着手条件。③Quality Gate・④Demo Gateの判定着手条件でもある）**
> S1・S2の全タスク（T-10〜T-17、**T-20/T-21/T-24/T-25を含む**T-20〜T-25）**および S2.5（T-30〜T-34）** が完了していること（S2.5はPRD rev.6でPhase 1に内包されたため、Quality/Demo Gateの対象に含む）。未完了タスクを残してS3へ進む場合は、**Team Leadによる明示的waive**（対象タスクID・理由・日付）をこのファイルに記録することを必須とする。waive記録なしにT-90〜T-92へ着手してはならない。
>
> **【Team Lead waive 記録 2026-07-25】** S2.5冒頭の waive 記録と**同一の対象・同一の理由**で、S3の集約条件についても waive する（対象: T-02・T-17・T-23・T-24・B-2＝T-25の実機計測部分／理由: B-3未作成と実艇練習という外部・人間依存／オーナー確認: セッション内AskUserQuestion回答 2026-07-25）。
> なおT-90のCIは、GitHubリモート（`origin` = happiitsumo-bit/sailvlog）が存在するため**deliverablesルールどおり構築対象に含む**（デプロイ許可とCI構築は別物）。

- [x] T-90: テスト整備＋CI（qa-engineer）
  - 成果物: lib/gpx・セッションAPI・認可の回帰テストを整理し、GitHub ActionsでPush時実行
  - **品質要件（deliverablesルールをここに転記して自己完結化。外部パス `~/.claude/rules/deliverables.md` は実行環境から解決できないため）**:
    1. 製品コード（パース・API・認可等の機能実装）には**回帰を捕まえるテストを最低1本**同時に用意する
    2. 実装完了の報告には**テスト実行結果（ログ）を添付**する（「通るはず」は不可）
    3. **GitHubリモートがあるリポジトリなのでCIを組む**（GitHub Actionsでpush時にテスト実行）。リモート運用をやめた場合はCIを外し、ローカルで回せるテストコマンドをREADMEに明記する
    4. READMEまたはdocs/に**「Q&A/トラブルシューティング」セクション**を作る（本タスクではテスト/CI、Q&A本文はT-91が担当）
  - 検証: CIグリーン。カバレッジ対象=「半年後に黙って壊れたら困る」パース/認可/API契約
  - **検証結果（2026-07-25・qa-engineer、担当範囲=CI構築とテスト整理のみ。Q&A本文はT-91）**:
    - **品質要件1（テスト最低1本）**: 既存で充足済み。backend 8 suites（t01/t10/t12/t15/t30/t31+health+resetDb系）・frontend lib/gpx 10件＋lib/replay 13件。今回は既存テストの追加実装は行わず、CI導線とテスト実行の安定化のみ担当。
    - **品質要件2（実行ログ添付）**: 下記「検証コマンドと実出力」参照。すべて実行してログを確認済み（「通るはず」ゼロ）。
    - **品質要件3（CI構築）**: `.github/workflows/test.yml`は既にimplementerが用意していた雛形（backend: postgres serviceコンテナ→`npx prisma generate`→`npm test`／frontend: `npm test`のみ）を確認し、**T-90の指示どおりfrontendジョブに`npx tsc --noEmit`と`npm run build`を追加**（既存の`npm test`=vitestはそのまま）。backend側は`npm test`のpretestフック（`scripts/ensure-test-db.js`）が`prisma migrate deploy`を内部で実行する構造だったため、指示にある「migrate deploy→jest」の順序は追加のCIステップなしで既に満たされている（ローカルで新規clone→`npm ci`→`npm test`のみで実際に動作することを確認済み＝下記ログ）。
    - **`--runInBand`判断（発見事項2026-07-24分への回答）**: **デフォルト化を採用**（`backend/package.json`の`"test"`スクリプトを`jest --runInBand`に変更、`backend/jest.config.js`に根拠コメント追加）。新規git clone環境で複数ワーカー並列（デフォルト）を3回実行し**毎回9〜22件が非決定的に失敗**（FK違反等、resetDbHook.tsのTRUNCATEと他ワーカーの実行中トランザクションが競合）することを実測で再現。同じ環境で`--runInBand`に切り替えて3回実行し**毎回8 suites/73 passed/0 failedで完全一致**（所要時間17.7〜17.9秒）。ワーカー毎テストDB分離も検討したが、この規模（8 suites・100ケース・直列で18秒）では並列化の時間短縮効果よりDB分離基盤の追加複雑度がROEで見合わないと判断（原則5）。
    - **テストのテスト（バグ注入確認）**: `backend/src/lib/validateTrackPayload.ts`のlat範囲チェック（`la < -90 || la > 90`）を`la < -900 || la > 900`に一時的に書き換えたところ、`t12-sessions-api.test.ts`の「latが[-90,90]範囲外は400」が期待400・実際201で即FAIL（1 failed/72 passed）を確認。直後に復元し全PASSに戻ることも確認（差分の実体は残していない・コミット対象外）。
    - **検証コマンドと実出力**（すべて`/private/tmp/.../scratchpad/ci-check`への新規git clone、CIと同じ「まっさらな環境」で実施。既存のdocker-compose共有コンテナは他エージェントの作業中セッションのため使わず、フレッシュチェックアウトのみで検証）:
      - frontend: `npm ci` → `npx tsc --noEmit`（エラー0） → `npm test`（vitest run: 2 files, 23 passed） → `npm run build`（`✓ Compiled successfully`、8ルート生成、`/`,`/handbook`,`/login`,`/register`,`/sessions`,`/sessions/[id]`,`/sessions/new`,`/_not-found`）
      - backend: `npm ci` → `npx prisma generate`成功 → `npm test`（`--runInBand`込み。pretestが`sailvlog_test`をCREATE→`prisma migrate deploy`→jest実行）→ **8 suites / 73 passed / 27 todo / 0 failed**（3回連続で完全再現・所要17.7〜17.9秒）
    - **CI実行結果（push後）**: コミット`bd5e541`をpush→`gh run view 30153031961`で確認、**backend/frontend-lib-tests とも✓ green**（backend 57s・frontend 44s）。同ブランチの直前3回のCI実行（`bc6b525`まで）は`.github/workflows/test.yml`初出時点から**全てbackendジョブが`npm test`（当時`--runInBand`なし）で赤**だったことを`gh run list`/`gh run view 30149196104`で確認済み＝T-90着手前は実際にCIが壊れていた（`X Run npm test`で終了コード1）。今回の修正でCIが初めてグリーンになった。node20非推奨の警告（GitHub Actionsランナー側の仕様変更、Node 24への強制実行）は両ジョブに出るが失敗要因ではない（対応は任意改善でありT-90の必須スコープ外のため未対応・記録のみ）。
    - **未達・T-91送り**: README/docsへの「Q&A/トラブルシューティング」セクション本文（品質要件4）はT-91の担当範囲のため本タスクでは着手せず。`ローカルで回せるテストコマンド`の実在確認は完了（frontend `npm test`／backend `npm test`）だが、README明記自体はT-91が実施。
    - **@testing-library/react 導入の要否**: TASKS.md発見事項（§7 a11y再点検、106行目）どおり必要性は認める（`role="status"`/`role="alert"`・label関連付け・24pxタップ対象などT-13/14/15/26で手動確認に留まっている項目の回帰を自動で捕まえられない）。ただし**今回は見送り**（`frontend/package.json`変更がimplementerの同時編集と衝突するため対象外・Team Lead承認制の新規npm依存でもある）。導入時の想定: `@testing-library/react`＋`@testing-library/jest-dom`をvitestに追加し、`/sessions/[id]`・`/sessions/new`・`/login`・`/register`のa11y属性（role/label/aria-label）のスナップショット的回帰テストを1〜2本ずつ追加する程度で十分（大規模なコンポーネントテスト網羅は不要＝ここもS規模の割り切り）。
  - 依存: MVP完了集約条件（上記）
- [ ] T-91: README＋Q&A＋デモ素材（docs-writer / demo-director）
  - 成果物: README刷新（v3の一言・起動手順・スクリーンショット/GIF・ピボット意思決定の記録リンク）＋Q&A/トラブルシューティング（使い方FAQ・cold start・GPXが読めない時・Geo Tracker設定ミス等の踏んだ罠と回避策・壊れたときの確認手順=ログの見方）
  - 検証: 第三者（オーナー以外の部員）がREADMEだけで閲覧まで到達できる
  - **検証結果（2026-07-26・docs-writer、担当範囲=文書パートのみ。デモGIF/スクリーンショットは未着手）**: `README.md` を全面刷新（v1/v2時代の「ナレッジシェアSNS」記述を一掃し、v3「反省会リプレイ・デバッガ」の一言＋なぜ作ったか＋主な機能＋技術スタック（選定理由付き）＋セットアップ＋テストコマンド＋使い方＋Q&A/トラブルシューティングの構成に刷新）。デモGIF/スクリーンショットは実体が無いため、画像リンクは作らず「未挿入」と明示するプレースホルダ文言のみ設置（デモ素材担当が後で差し替える前提）。
    - 実行して確認したコマンドと実出力: ①`docker compose exec backend npm install`（`Cannot find module 'pg'`を解消。`node_modules`が匿名ボリューム固定でpackage.json更新が反映されない既知問題の再現・解消を確認）②`docker compose exec backend npm test` → `8 suites / 73 passed / 27 todo / 0 failed`（約17秒）③`docker compose exec frontend npm test` → `5 files / 42 passed`（Vitest。T-20/T-25分含め既存より増加を確認＝実装レーンの並行作業を反映）④`docker compose exec frontend npx tsc --noEmit` → エラー0（`.next/types`配下の削除済みv2ページ参照はキャッシュ起因の警告のみでビルドには影響しないことを`npm run build`で確認）⑤`docker compose exec frontend npm run build` → 成功、8ルート生成（`/`, `/handbook`, `/login`, `/register`, `/sessions`, `/sessions/[id]`, `/sessions/new`, `/_not-found`）⑥`curl`で`/login`・`/register`・`/sessions`・`/handbook`が200、`http://localhost:8001/api/teams`が200、`http://localhost:8001/api/auth/login`が401（想定どおり）、`http://localhost:8001/api/questions`が410（凍結ルート）であることを実測。
    - **副作用と復旧**: 検証中に`next dev`が動いている同一frontendコンテナで`npm run build`（本番ビルド）を実行したため`.next`が競合し、devサーバーが`TypeError: Cannot read properties of undefined (reading 'call')`で500を返す状態になった。`docker compose restart frontend`で復旧し`/`が200へ戻ることを確認済み（他レーンの作業への実害は無かったが、Q&Aセクションに「壊れたときの確認手順」としてこの事象と復旧法を明記した）。
    - 未検証として残した箇所: ①「第三者（オーナー以外の部員）がREADMEだけで閲覧まで到達できる」の実地確認はオーナー/部員による実施が前提のため未実施 ②`docs/README.md`は他レーン由来の未コミット差分（mockups行の追加のみ）が残っていたため、内容を変更せずそのまま保持（本タスクでは触っていない）。
    - デモ素材担当への申し送り: README冒頭のプレースホルダ（「ここにデモGIF/スクリーンショットが入ります」の行）に、`/sessions/[id]`の複数艇再生＋タイムライン注釈が伝わる素材を差し込んでください。挿入後はプレースホルダ文言を削除し、画像パスに置き換えてください（存在確認のうえコミットすること）。
  - **検証結果（2026-07-27・qa-engineer継続、担当範囲=REVIEW.md「テスト・CIの評価」の未カバー経路埋め＋27件todoの精査）**:
    - **27 todoの判断**: `sessions-api.todo.test.ts`（`test.todo`27件、T-12/T-15の実装前スキャフォールド）を精査した結果、**全27件が既に`t12-sessions-api.test.ts`・`t15-annotations-api.test.ts`の実テストとして1対1で実装済み**（項目名を突き合わせ確認）。実装されずに惰性で残っていたtodoは0件。ファイル自体が「実装待ち」の意味を失った死んだ足場のため**削除**（`git rm backend/src/__tests__/sessions-api.todo.test.ts`）。
    - **REVIEW.md「テスト・CIの評価」#1〜#4への対応**:
      1. 部内API `publicViewCount` 漏洩: `GET /api/sessions/:id`はMajor3修正で既に除外済みだったが、**`GET /api/sessions?teamId=`（一覧）は select 無しの `findMany` のままで同じ非KPI項目が漏れている**ことをコードレビューで発見（`routes/sessions.ts:96-100`）。`t97-response-hardening.test.ts`に**バグを再現・固定する形で追加**（現状FAIL・意図的に残置。下記「発見したバグ」参照）。
      2. 公開中セッションへのトラック追加即時反映（R-05）: Team Lead裁定（2026-07-26記載）どおり「backend現状維持」が正式な仕様であることを踏まえ、`t98-publish-lifecycle.test.ts`に**現在の挙動を仕様として固定する回帰テスト**を追加（トラック追加後、昇格ダイアログを経ずに公開ペイロードへ即反映されることを確認。将来この挙動が意図せず変わった場合に検知できる）。
      3. unpublish→publishでの前回isPublic選択の引き継ぎ: `t98-publish-lifecycle.test.ts`に追加。再公開時に`publicAnnotationIds`を渡さないと前回公開注釈も非公開へ戻ることを固定（publish処理の「毎回全件false→選択分のみtrue」という1行に安全性が依存している事実を明示するテスト）。
      4. backendのCI `tsc --noEmit`/`npm run build`: 本日中に別コミット（`309b035`）で追加済みであることを確認（担当範囲外だが状態確認のみ実施）。
    - **追加でカバーした危険な経路（qa-engineer判断による優先度順の追加分）**:
      - カスケード削除の完全性: 既存テストはTrackのみ確認していたため、`t97-response-hardening.test.ts`でAnnotationも同時に削除されることを追加確認。公開中(unlisted)セッション削除後、公開URLが「取り消し済み」と同一の404レスポンスになることも確認。
      - エラー時の内部情報非漏洩: `t96`のグローバルエラーハンドラ検証を深掘りし、DB例外発生時の500レスポンスにスタックトレース・SQL文・ファイルパス・`prisma`文字列が含まれず、固定の汎用メッセージ(`{"error":"Internal Server Error"}`)のみであることを固定。
      - マスアサインメント防御: `POST /api/sessions`で`uploaderId`/`publicViewCount`/`publicSlug`/`visibility`を混入しても無視されること、`PATCH /api/sessions/:id`で`visibility`/`publicSlug`/`publishedAt`を混入しても無視されることを確認（IDOR/権限昇格の初歩的な防御線）。
      - 認可マトリクスの穴埋め: `GET /api/sessions?teamId=`に対する非TeamMember(IDOR)403・未認証401のテストが存在しなかったため追加。
      - 入力境界（`t99-input-boundaries.test.ts`）: `durationSec`の0/負数/null/文字列/小数/配列/上限超過/上下限ちょうど、`teamId`の存在しないID・型違い・null、`tSec`の下限0/上限durationSecちょうど/負数/小数/文字列型違い、`body`のnull/空白のみ/2000字ちょうど境界、不正なID形式(`/api/sessions/not-a-number`)を追加。
    - **発見したバグ（未修正・報告のみ。backendコード自体は変更していない）**: `GET /api/sessions?teamId=`（`routes/sessions.ts:96-100`）が`select`無しの`findMany`のため、`publicViewCount`（PRD §6の非KPI項目・GET /:idでは既に除外済み）が部内メンバー全員に見える。Major3修正がGET /:id限定だったための取りこぼしと考えられる。**`t97-response-hardening.test.ts`の「[既知の未修正: バグ再現テスト]」は意図的にFAILのまま残置**（`select`を明示的に絞ればGREENになる1行修正で、実装はimplementer/Team Lead判断に委ねる）。
    - **参考として報告のみ（テスト追加はスコープ外・時間対効果で見送り）**: `routes/teams.ts`の`GET /:slug/articles`・`GET /:slug/questions`はBlocker修正（T-95）の対象に含まれず未認証のまま残っている。v3では作らない機能（PRD §5「作らないもの」）でArticle/Questionテーブルは実質空だが、認可の一貫性という観点ではteams.ts本体（`/`・`/:slug`）と同じ穴が同居している。410凍結にするか認証必須化するかはarchitect/Team Lead判断が必要（R-01と同種だが実害は低いと考える）。
    - **テストのテスト（バグ注入確認）**: `lib/validateAnnotationPayload.ts`の`tSec`範囲チェック（`(tSec as number) > durationSec`）を一時的に`>= durationSec`に書き換え、`t99-input-boundaries.test.ts`の「tSec=durationSec(上限ちょうど)は201」が期待201・実際400で即FAILすることを確認。直後に復元し全PASSに戻ることも確認（差分はコミットに含めていない）。
    - **実行結果（実出力・`docker compose exec backend npx jest --runInBand`）**: 削除(todo 1suite)＋新規追加(3suites)で **12 suites / 115 passed / 1 failed / 0 todo**（既存84 passed全件を維持した上で+31、todoは0に整理。所要26.9秒）。唯一のFAILは上記「発見したバグ」を意図的に固定したテストで、隠さず記載する。
      ```
      FAIL src/__tests__/t97-response-hardening.test.ts
        ● GET /api/sessions?teamId= (T-90 追加) › [既知の未修正: バグ再現テスト] 一覧レスポンスにpublicViewCountが含まれない — 現状FAIL
          expect(received).not.toContain(expected)
          Expected substring: not "publicViewCount"
          Received string: "{\"sessions\":[{...,\"publicViewCount\":3,\"teamId\":1,\"uploaderId\":1,...}]}"
      PASS src/__tests__/t99-input-boundaries.test.ts
      PASS src/__tests__/t98-publish-lifecycle.test.ts
      PASS src/__tests__/t12-sessions-api.test.ts
      PASS src/__tests__/t30-publish-api.test.ts
      PASS src/__tests__/t31-public-api.test.ts
      PASS src/__tests__/t15-annotations-api.test.ts
      PASS src/__tests__/t95-auth-required-blocker.test.ts
      PASS src/__tests__/t01-frozen-routes.test.ts
      PASS src/__tests__/t96-global-error-handler.test.ts
      PASS src/__tests__/health.test.ts
      PASS src/__tests__/t10-session-track-annotation.test.ts
      Test Suites: 1 failed, 11 passed, 12 total
      Tests:       1 failed, 115 passed, 116 total
      ```
    - 触っていないもの: `frontend/`一切・`backend/src/`の製品コード・`REVIEW.md`/`REVIEW-backend-2.md`/`ARCH.md`/`UI-DESIGN.md`/`design-system/`（architect/code-reviewerが同時作業中のため）。新規npm依存の追加なし。
  - 依存: MVP完了集約条件（上記）
- [ ] T-92: リリース＋計測準備（release-manager）
  - 成果物: PRD §6の成功指標①〜③を数えるSQL（アップロード数・注釈数の集計クエリ）をdocsに記載。knowledge還流（RESEARCH.md §5の候補を/tilへ）
  - 検証: SQLがNeon上で動き数値が返る
  - **検証結果（2026-07-26・Team Lead差し戻し対応版）**: Team Lead指摘5件の修正完了。修正内容: ①指標①は分子のみ出力（分母=部内記録の実施日数）と明記＋率算出式記載 ②指標②は部内記録を正式計測方法、SQLは参考値と位置づけ（注釈ゼロ=使用なしではない） ③共有1→2条件①は`publishedAt IS NOT NULL`で昇格済み全数対象に修正 ④条件③は「0回以上」削除＋`publicViewCount > 0`明記 ⑤運用手順「ダッシュボード」→「スプレッドシート等の部内記録」に修正 ⑥団体名をプレースホルダ化、Phase 1開始日・終了日をプレースホルダに変更。修正版SQL検証（ローカルPostgreSQL）: ①range:2026-07-15〜31 total=2(practice=2,race=0) ②月別集計 2026-07:2セッション,3注釈 ③累計 3注釈,2セッション ④昇格済み:0件 ⑤閲覧記録:0件。全SQL エラー0で数値返却。**Neon未検証（B-3ブロック中）。knowledge還流は担当外（除外）。**
  - 依存: T-91

## バックログ（MVP計画外。実施条件の成立まで着手禁止）

- [ ] BL-01: contract削除migration（旧T-93。ADR-005の完了。**Codexレビュー裁定 2026-07-24でMVP必須タスクから降格**）
- [ ] BL-02: ネイティブアプリ化（オーナー裁定 2026-07-24: 「ネイティブアプリとして考えます。ただ今ではないのでステイ」。MVPはWebレスポンシブ+既存GPSロガー委託のまま。中間段階のPWA化も未着手。SNS層本格化・全国展開の段階で再検討）
  - 成果物: Post/PostLike/Followのモデル・ルートコードを削除し、**新規のcontract migration（DROP TABLE）を追加する。既存のmigration履歴ファイルは削除しない**（履歴改変は他環境のmigrate整合を壊すため）
  - 実施条件（**両方必須**）: ①PRDのPhase 1（MVP・8週間）の実運用が安定した後 ②オーナーの明示承認
  - 検証: migrate後に全テスト・全画面が通る。Article系はスキーマ残置のままであること

## 実装ルール（implementer への契約）

1. **S1 を最優先。** 全部の部品を作ってから繋ぐのではなく、最初に細く貫通させる。ただし縦1本は最初から**複数艇**で通す（1艇では時刻同期という本質的難所を検証できない）
2. タスク完了時は必ず「検証」欄の方法で確認し、結果をこのファイルのタスク下に1行追記する（数値・スクリーンショットパス込み）
3. スコープ外の改善を見つけたら、勝手にやらず「発見事項」に追記して続行。特にPRD §5「明示的に入れない」リスト（自動解析・3D・LIVE・動画・ゲーミフィケーション）は提案も不要
4. 詰まって30分（または3アプローチ）超えたら、抱え込まずTeam Leadに報告（codex:rescue 委譲の判断材料）
5. `spike/` のコードは参照のみ。コピーして本実装に混ぜない（設計パターン: グリッド+indexアクセス/rAF+ref/ローカル平面投影 は引き継いでよい）
6. 新規npm依存の追加はTeam Lead承認制（本設計は依存ゼロで成立する。ARCH.md §1「新技術予算温存」）
7. **UI実装タスク（T-13/T-14/T-15/T-25/T-26/T-32/T-33）は UI-DESIGN.md §7「実装時の必須修正」10項目を完了条件に含める**（モックアップはアーカイブであり、§7と食い違う場合は本仕様§7が正。2026-07-25追加）
8. **S2.5（共有1）はS1/S2の全完了まで着手しない。** 「小さいから先にやってしまう」は本プロジェクトで最も危険な逸脱（PRD第6リスク＝v1が寄せ集めになった経路と同型）。また §S2.5 の「作らないもの」リストはPRD §5「明示的に入れない」と同格の禁止事項として扱い、提案もしない（2026-07-25追加）
9. **未認証で読めるコードを書くときは、含めるものだけを列挙する**（ADR-007）。公開レスポンスに新しい値を足すときは、同時にT-31の禁止キー非含有テストを更新する。「除外し忘れ」が事故になる構造を作らない

## 発見事項（実装中に見つけたスコープ外の課題）

- （実装者 2026-07-25・T-26/DS適用）**このセッションはMac環境でDocker Desktopが稼働しており、`docker-compose.yml`のコンテナ（`sailvlog-frontend-1`/`sailvlog-backend-1`/`sailvlog-db-1`）が別セッションによって既に起動済みだった**（bind mountのためホスト側のfrontend/backendコード変更が即座に反映される）。parallel-dev運用上、複数エージェントが同一ワークツリー・同一コンテナ環境を同居利用している状態を`git worktree list`ではなく`docker ps`で検知した形。破壊的操作（コンテナ再作成・DB reset等）はせず、既存コンテナに対してHTTP経由の読み取り・テストユーザー登録のみ行った。テスト用ユーザー（`t26test<timestamp>@example.com`）を1件、開発用DBに残置（チーム未所属・パスワードはテスト専用文字列のみ・実害なし）。
- （実装者 2026-07-25・T-26）ログイン成功直後、TopBarの`@username`表示が即座に反映されない（`Login`/`Join`ボタンのまま）ことを実ブラウザE2Eで確認。原因は`TopBar`の`useEffect(() => setUsername(getUser()?.username), [])`が空依存配列でマウント時1回しか走らず、`layout.tsx`のトップバーはNext.js App Routerのルート跨ぎで再マウントされないため（`router.refresh()`はサーバコンポーネントのみ再検証し、この既にマウント済みのクライアントコンポーネントのstateは更新されない）。**この挙動は今回の変更で新規に作ったものではなく、書き換え前のTopBar.tsxも同一のuseEffectパターンだったため、既存の潜在バグ**（`/sessions`への遷移自体・データ取得は正常）。修正には認証状態のグローバル管理（Context等）かpathname変化を監視するuseEffectが必要で、DS適用・T-26どちらのスコープでもないため実装者判断では直さず記録のみ。
- （実装者 2026-07-25・DS適用）`globals.css`には旧v2専用コンポーネントのCSS（`.article-card`/`.question-card`/`.post-card`/`.course-card`/`.sailor-card`/`.comment-*`/`.profile-*`/`.editor-*`/`.tag-checkbox`/`.bento-grid`/`.sidebar-nav-*`等、T-26で対応するページが全て削除済み）が死んだコードとして約1000行超残っている。DSトークンのエイリアス経由で配色は自動追従するため実害はないが、ファイルサイズ・可読性の観点で将来の一括削除が望ましい。今回はDSトークン差替とT-26のページ削除に留め、CSSの大規模delete pruningはスコープ外として着手しなかった（対応要否・実施時期はTeam Lead判断）。
  - **クローズ（2026-07-27・routine・REVIEW.md Minor R-11対応）**: code-reviewerが上記課題を再点検し「実害なし」と判定（該当クラスを参照するTSXが無い＝誤適用なし／DSトークンのエイリアス経由で配色は自動追従／転送量増分は数KB規模で性能上の意味なし。唯一のコストは可読性）。結論として「ADR-003の凍結コードと同じ扱いにし、BL-01（contract migration）と同時に一括削除。デモ前の今のタイミングでは消さない」と提案（REVIEW.md R-11）。実装は不要につきコード変更なし、本エントリへの追記のみでR-11をクローズする。
- （実装者 2026-07-24・T-15）**このセッション実行環境にはPostgreSQL 16がaptでローカルインストール済み**（`/usr/lib/postgresql/16/bin/`, `service postgresql start/stop`で起動可能。Dockerデーモンは無いが、Docker越しでなく直接Postgresが使える）。手順: ①`service postgresql start` ②初回のみ`sudo -u postgres psql -c "CREATE ROLE sailvlog_user WITH LOGIN PASSWORD 'sailvlog_pass' SUPERUSER;"` ③`.env.test`はポート5433(docker-compose想定)を指しているため、実行時に`DATABASE_URL=postgresql://sailvlog_user:sailvlog_pass@localhost:5432/sailvlog_test npm test -- --runInBand`のように**ポート5432で上書き**する（`.env.test`ファイル自体は変更しない。dotenvは既存env変数を上書きしないため有効）。これで`backend`のsupertestが**モックなしの実DB統合テスト**として通る。T-90（CI構築）はGitHub Actions側でpostgres serviceコンテナ（5433）を使う前提のままでよいが、**日々のローカル検証はこの手順で「DBが無いのでユニットテストのみ」を避けられる**ので、次回以降のセッションでも先にこの手順を試すことを推奨（ダメならこれまで通りモック/ユニットテストのみに縮退）
- （実装者 2026-07-24・T-15）上記の発見を活かし`frontend`側も実backend（`npm run dev`, DATABASE_URL=sailvlog_db）に対してPlaywrightで手動UIフロー（取込→再生→注釈→リロード→ピンシーク）を検証しようとしたが、**検証スクリプト実行中にこのセッションのワーカープロセスが再起動され**、Postgresサービス・next/backendのbackgroundプロセスが失われて中断した（コード変更は無事・失われたのは検証作業のみ）。再現手順: ①`service postgresql start` ②`sudo -u postgres createdb -O sailvlog_user sailvlog_db`（初回のみ）③`DATABASE_URL=postgresql://sailvlog_user:sailvlog_pass@localhost:5432/sailvlog_db npx prisma migrate deploy`(backend/) ④`DATABASE_URL=...sailvlog_db JWT_SECRET=dev_local_secret PORT=8000 CORS_ORIGIN=http://localhost:3100 npm run dev`(backend) ⑤`curl -X POST localhost:8000/api/auth/register`でユーザー作成→`psql`で`Team`/`TeamMember`行を直接INSERT（teams作成の公開APIが無いため） ⑥`API_URL=http://localhost:8000 npm run start -- -p 3100`(frontend, 事前に`npm run build`済みであること) ⑦Playwright（`/opt/node22/lib/node_modules/playwright`, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`）でlocalStorageにtoken/userをセットして`/sessions/new`から操作。次回セッションでこの手順を再実行すればT-13〜T-16の手動UI検証を実DBで完了できる

- （実装者 2026-07-24・T-14）Docker/PostgreSQLが無い環境でも`/sessions/[id]`等の実ブラウザ性能検証を行う手順を確立: ①`spike/gen-gpx.js`で実規模GPXを生成→②`lib/gpx`の本番パーサでJSON化→③Node標準httpのみの使い捨てモックAPIサーバ（`GET /api/boat-types`等の空応答＋対象エンドポイントのフィクスチャ応答、CORS対応必須）→④`NEXT_PUBLIC_API_URL`と`API_URL`を同じ値にして`next build && next start`（**NEXT_PUBLIC_*はビルド時埋め込みのため`next start`時にセットしても効かない点に注意**）→⑤環境にプリインストール済みのPlaywright（`/opt/node22/lib/node_modules/playwright`、`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`）でHeadless Chromiumから操作・計測。T-20（2艇比較55fps計測）・T-25（スマホ想定のviewport計測）でも同じ手順が使い回せるはずなので記録しておく（本番コード・テストには含めていない使い捨て手順のため、必要なら次回実装者がscratchpadで再構築する）

- （実装者 2026-07-24・T-13）ログインユーザーが「自分の所属チーム」を取得するAPI（例: `GET /api/users/me`にteamMembers含める）が存在しない。ARCH.md §4はteamId選択の実装方法まで規定していないため、`/sessions/new`・`/sessions`一覧とも`GET /api/teams`（既存公開エンドポイント・全チーム一覧）から選択する方式で実装（questions/newのboatType選択と同じパターン）。非メンバーのチームを選んでもPOST /api/sessionsが403を返すため実害はないが、UXとしては「自分のチームだけ出す」方が親切。ARCH変更が必要な提案のため実装者判断では追加せず記録のみ（対応要否はarchitect/Team Lead判断）
- （実装者 2026-07-24・T-13）取込ウィザードで複数艇のtracks投稿が途中失敗した場合（例: 3艇目のPOSTがネットワークエラー）、Sessionは作成済みのまま一部Trackのみ保存された不完全な状態が残る（トランザクション/ロールバックの仕組みがAPI契約にない）。頻度は低いと見積もるが、発生時はユーザーがそのSessionを手動削除して再取込する以外の回復手段がない。API側にトランザクション化や「tracks一括投稿」エンドポイントを足すのはARCH.md §4のI/F変更にあたるため実装者判断では行わず記録のみ

- （実装者 2026-07-24・qa-engineer TEST-PLAN.md §6への回答）`Session.visibility`はARCH.md §3には無いが、Team Lead本人からの本セッション追加指示（知の共有層rev.4前方互換。`docs/dev-org/PRD-rev4-sharing-layer.md`参照・Annotationには追加しない）に基づく実装。ARCH.md §3への追補が必要ならarchitect側でADR/ARCH更新をお願いします
- （実装者 2026-07-24）`docker compose exec backend npx jest`（デフォルト＝複数ワーカー並列実行）で、qa-engineerのグローバルフック`resetDbHook.ts`（各testの前にDB全体をTRUNCATE）と複数テストファイルの並列実行が競合し、まれに「ユーザーが存在しない」等のFK違反で失敗することを確認（t12-sessions-api.test.ts等では再現・非再現があり、`--runInBand`（直列実行）では常に全PASS）。ロジックバグではなく共有テストDB×並列ワーカーのレース。CI/ローカルで`jest --runInBand`をデフォルトにするか、テストDBをワーカーごとに分離するかの対応要否をqa-engineer(T-90)に判断を委ねる
- （実装者 2026-07-24）フロントのdocker-compose volumesは`frontend/src`と`frontend/public`のみマウントで、`package.json`/`vitest.config.ts`はイメージビルド時の内容のまま更新されない。ホストでpackage.jsonを編集した後は `docker compose cp frontend/package.json frontend:/app/package.json && docker compose exec frontend npm install`、`docker compose cp frontend/vitest.config.ts frontend:/app/vitest.config.ts` が必要（container再ビルドまたはvolume追加で恒久化を検討。今回はスコープ外につき対症のみ）
- （実装者 2026-07-24）T-90のテストDB分離（`.env.test`＋`setup/env.ts`）は、`docker compose exec backend npx jest`（コンテナ内実行）だとdocker-compose.ymlが先にDATABASE_URLを開発DB向けに注入済みのため、`dotenv.config()`のデフォルト（既存env上書きしない）で`.env.test`の値が無視され、**開発DB(sailvlog_db)に対してテストが実行される**（テストDB分離が効かない）。ホスト実行・CI実行では発生しない可能性が高いが未確認。qa-engineer(T-90)へ確認・対応要否の判断を委ねる

- （実装者 2026-07-26・T-20/T-25）**このセッションの実行環境はmacOS（Darwin, darwin/arm64）で、以前の発見事項（2026-07-24分）にある`/opt/node22/lib/node_modules/playwright`は存在しない**（別環境=Linuxサンドボックスを前提にした記録だったと判明）。今回はプロジェクトへの新規npm依存追加をせず、`npx --yes playwright`（`~/.npm/_npx/`配下にキャッシュされる、`package.json`は変更されない）＋`npx --yes playwright install chromium`（`~/Library/Caches/ms-playwright/`にブラウザバイナリを取得）で代替した。次回以降Mac環境でPlaywright実測が必要な場合はこの手順を先に試すことを推奨（`require('/Users/<user>/.npm/_npx/<hash>/node_modules/playwright')`のようにキャッシュパスを直接requireする必要がある。`npx playwright --version`実行後に`find ~/.npm/_npx -iname playwright -type d`でハッシュ付きパスを特定できる）。
- （実装者 2026-07-26・T-20/T-25）docker-compose（backend:8001/frontend:3001/db:5433、開発DB `sailvlog_db`）が既に稼働中だったため、これを使ってfps実測用のテストユーザー（`t2025impl@example.com`, User.id=4）を1件登録し、既存のT10テストチーム（teamId=1）へ`docker compose exec db psql -U sailvlog_user -d sailvlog_db`で`TeamMember`をadmin権限で直接INSERTして参加させた。実データ（6艇×7200点の実規模GPX、`spike/gen-gpx.js`生成物）を実際にウィザードからアップロードしたテストセッションが8件（id 2〜9、タイトル「T20 fps計測用セッション」）開発DBに残置している（実害なし・T-26時の残置テストユーザーと同様の扱い。削除は行っていない）。
- （実装者 2026-07-26・T-20実測スクリプトのデバッグメモ）rAFフレーム間隔計測の初回実装で「`if (t < durMs)`（tはページロードからの絶対タイムスタンプ）」を継続条件にしてしまい、ページ滞在時間が3000msを超えた2回目以降の計測（4x/8x）が1フレームで即終了するバグを作り込んだ。`performance.now()`の`t`はrAFコールバック引数では*絶対値*であり、計測開始時刻を`start`として`t - start < durMs`のように相対化する必要がある（"3秒間計測する"つもりが暗黙に"ページ表示から3秒以内"になっていた、という典型的な絶対/相対時刻の取り違え）。次回rAFベースの区間計測を書くときは要注意。
- （実装者 2026-07-26・③Quality Gate Blocker/Major修正）**Blockerの実際の経路**: 共有1で `/p/[slug]`（公開ビュー）がチーム名を表示するようになったことで、`GET /api/teams`（未認証で全チームslugを返す）→`GET /api/teams/:slug`（未認証でmembers[].user.username/specialty/experienceYears/avatarUrl/boatTypeを返す）という2段の未認証呼び出しで部員名簿が特定できる経路が初めて成立していた。`teams.ts`の`/`と`/:slug`に`authMiddleware`を追加して閉じた。同種の指摘（同じく未認証でspecialty等が取得できていた）が`sailors.ts`（`/`・`/:username`）・`users.ts`（`/:username`）にもあったため同様に認証必須化した。事前確認の結果、フロント側の呼び出し元（`frontend/src/lib/teamRole.ts`・`sessions/page.tsx`・`sessions/new/page.tsx`・`sessions/[id]/page.tsx`）は全て`isLoggedIn()`ガード後にのみ`api.get()`を呼んでおり、`lib/api.ts`がlocalStorageのtokenを自動付与するため無改修で動作する（`npx tsc --noEmit`エラー0・`npx vitest run`54件PASS・`npm run build`成功で確認済み）。回帰テストは`backend/src/__tests__/t95-auth-required-blocker.test.ts`に新規追加（未認証401・認証済み200を5エンドポイントぶん）。curl実測: `GET /api/teams`・`/api/sailors`が未認証401、JWT付きで200を確認。
- （実装者 2026-07-26・Major1: レート制限/閲覧数カウントの実効性）`GET /api/public/sessions/:slug`はNext.jsのサーバーコンポーネント（`/p/[slug]`）から叩かれるため、backend視点のreq.ipは常に「Next.jsサーバー1台のIP」に潰れる。**採用方式**: `frontend/src/lib/publicSession.ts`が`next/headers`の`headers()`からx-forwarded-for/x-real-ipの先頭値を読み取り、`x-forwarded-client-ip`ヘッダとしてbackendへ転送。backendの`public.ts`の`clientIp()`はこのヘッダを優先し、無ければ従来通り`req.ip`にフォールバックする。新規npm依存なし。**限界（明記が必要な事項）**: backendのポートに直接到達できる呼び出し元（今回のdocker-compose公開ポート、本番Renderでもbackend自体が公開URLを持つ）はこのヘッダを任意に詐称できる（Next経由を強制する仕組みではない）。とはいえMajor1本体の実害（全アクセスが1台のIPに潰れてレート制限/publicViewCountが機能しない）は解消される。回帰テストは`t31-public-api.test.ts`に追加（④-b: 異なる`x-forwarded-client-ip`は別バケットとして扱われることを確認）。
- （実装者 2026-07-26・Major2: DB例外でプロセスが落ちる問題）当初`express-async-errors`（新規npm依存）で解決したが、**Team Lead却下**（実装ルール6「新規npm依存はTeam Lead承認制」違反・ARCH.md §1「依存ゼロ」原則違反・パッケージの保守状況リスク）。依存を撤去し、`backend/src/lib/asyncHandler.ts`の薄い`wrap()`関数（`Promise.resolve(fn(...)).catch(next)`のみ、外部依存ゼロ）に置換。mount済みルータのうちtry/catchを持たない全ハンドラ（auth/users/sailors/sessions/tracks/annotations/public）をwrap()で包み、`index.ts`のグローバルエラーハンドラで確実に500へ落とす。加えて`process.on("unhandledRejection"/"uncaughtException")`を多重防御として追加（wrap()の適用漏れやExpress層外の例外でもプロセスは落とさない）。検証テスト`t96-global-error-handler.test.ts`でDB例外を意図的に発生させ、プロセスが落ちずに500が返り直後の別リクエストも正常応答することを確認。
- （実装者 2026-07-26・Major3: publicViewCountが部内APIに漏出）`GET /api/sessions/:id`が`prisma.session.findUnique`の全カラムをそのまま`res.json`していたため`publicViewCount`（PRD §6「SQLでのみ参照・UI表示や成功指標にしない」非KPI項目）が含まれていた。レスポンス直前で`publicViewCount`を分割代入で除外。curl実測で`GET /api/sessions/:id`のレスポンスに`publicViewCount`キーが存在しないことを確認（`POST /api/sessions`のレスポンスには残っているが対象外＝Team Lead指示は`GET /api/sessions/:id`限定）。
- （実装者 2026-07-26・並行セッションとの同居事故）Team Lead復旧後の指示で発覚: 私が意図せず`design-system/styles.css`・`docs/dev-org/ARCH.md`・`docs/dev-org/UI-DESIGN.md`を含むコミット(`1ade728`)が生成されており、`styles.css`に存在しないADR-008を根拠とする重複トークン定義が混入していた（parallel-dev.mdが警告する「同一ディレクトリの同居事故」の実例。原因はセッション中断/復旧の狭間で別セッション=architectの未コミット編集と私の変更が同一ワークツリー上で混ざったこと）。Team Lead指示で`design-system/styles.css`を`git checkout 9193375 --`で一旦revertしたが、**その後の再確認時点で該当ファイル群はHEADと差分なし（=既にarchitectによる正規のADR-008策定が完了・コミット済みの状態）だったため、reveretは反映されず/上書きされず、現状はarchitectの成果がそのまま残っている**。ADR-008は`docs/dev-org/ARCH.md`に実在することを確認済み。担当外ファイルへは以後一切手を入れていない。
- （実装者 2026-07-26・R-03残穴対応: backend側のみ。frontendはCodex担当のため範囲外）Team Lead指摘の通り、`x-forwarded-client-ip`を無条件に信頼する実装は「backendへ直接到達できる呼び出し元がヘッダを詐称できる」問題を残していた。**採用方式**: `backend/src/routes/public.ts`の`clientIp()`に、別ヘッダ`x-internal-proxy-secret`と環境変数`INTERNAL_PROXY_SECRET`（`crypto.timingSafeEqual`で比較。長さ不一致時もダミー比較を行い早期returnしない）が一致した場合のみ`x-forwarded-client-ip`を信用する`proxySecretMatches()`を追加。**未設定時は常に不一致扱い＝安全側フォールバック**（`req.ip`を使用。詐称もレート制限回避もできないが、Next経由の実クライアント単位カウントも効かなくなる＝機能低下側に倒れる設計）。`backend/.env.example`を新規作成（従来`backend/.env`のコメントが`cp .env.example .env`を前提にしていたのに実体が無かった不整合も合わせて解消）し、`INTERNAL_PROXY_SECRET`の生成方法・未設定時挙動・**frontend側にも同じ値の設定が必要（Codex担当・NEXT_PUBLIC_プレフィックスを付けてはいけない＝ブラウザに漏れないようにする）**ことを明記。ローカル動作確認用に`docker-compose.yml`のbackendサービスへ開発専用ダミー値を追加（frontend側の対応する設定はこのコミットでは変更していない＝Codex側の作業）。**Codexへの申し送り（ヘッダ仕様）**: ヘッダ名`x-internal-proxy-secret`／値は`INTERNAL_PROXY_SECRET`環境変数の値をそのまま文字列送信／送信元は`frontend/src/lib/publicSession.ts`のサーバー側fetchのみ／未設定・不一致時はbackendが自動的に`req.ip`へフォールバックする（frontend側が意識すべき挙動変化は無い＝送るだけでよい）。回帰テストは`backend/src/__tests__/t31-public-api.test.ts`に追加（④-b: 正しいシークレット併送時のみ転送IPが別バケットとして扱われることを確認するよう既存テストを更新／④-c: シークレット無し・④-d: シークレット不一致・④-e: 環境変数側が未設定、の3パターンいずれも詐称ヘッダが無視されreq.ipバケットに丸まることを新規追加）。検証: `docker compose exec backend npx jest --runInBand` → **10 suites / 83 passed（既存80+新規3）/ 0 failed**（実行ログ確認済み）。`curl http://localhost:8001/api/health`→200、`curl http://localhost:8001/api/public/sessions/does-not-exist`→404を確認（`docker compose up -d --build backend`でINTERNAL_PROXY_SECRET付き環境を再ビルド後に実施）。
- （実装者 2026-07-26・R-05: backend側の追加防御要否判断）Team Lead指示によりbackend側は判断・記録のみ（実装＝フロント警告UIはCodex担当）。**結論: backend側の変更は不要**。理由: ①R-05の本質は「公開中セッションに気づかず航跡を追加してしまう」という**同意取得の抜け**（UX/プライバシー配慮の問題）であり、権限の欠陥ではない。トラック追加はどのみち`requireSessionTeamMember()`を通過した本人（Team memberかつ多くの場合uploader/admin）にしか許されておらず、その人物は元々`POST /:id/publish`で同じセッションを非公開へ戻す権限も持つ＝バックエンドの認可境界としては既に閉じている。②同意は「その場で見せて確認を取る」一回性のUI操作であり、DBに永続化すべき状態ではない。backend側で強制するには「公開中は`?acknowledged=true`のようなクエリ/ボディ確認フラグが無い限り拒否する」実装が考えられるが、これは**Codexが並行して設計中のフロントAPI呼び出し契約に無断で新しい必須パラメータを追加する**ことになり、並列開発の分離原則（同じ契約面を2チームが同時に触らない）に反する。③データモデル拡張（`Track`への公開状態フラグ）はTeam Lead裁定で不採用（案B＝YAGNI）。永続化された同意フラグを持たない以上、backend側にチェックすべき対象データが無い。注釈`PATCH`（公開済み注釈の本文差し替え）についても同じ理由で backend 側の変更は不要と判断（同一の認可主体・同一の同意タイミング問題であり、UI警告で閉じるのが妥当）。以上より**R-05の実装はフロント（Codex）の警告ダイアログのみで完結し、backendは現状維持**。
- （実装者 2026-07-27・REVIEW-backend-2.md Minor m-01〜m-06対応）担当6件のうち**m-01（teams.tsが独自PrismaClientを生成）は着手前から既に解消済み**だったことを確認した（`teams.ts`は既に`import prisma from "../database"`を使用しており、`grep -rn "new PrismaClient" src/`のヒットは`database.ts`の1箇所のみ。恐らくB-02修正時にteams.tsが書き直された際に同時解消。コード変更・コミットは無し）。残り5件は実施:
  - **m-02**（レート制限/閲覧間引きMapの破棄処理なし）: 新規`setInterval`は追加せず、アクセス時に確率1%でMap全体の期限切れエントリを掃除する遅延方式を採用（`lib/rateLimiter.ts`）。判断理由: windowMsが60秒/300秒と短くアクセス頻度に比例して自然に間引かれるため、タイマーを増やす追加コストに見合わない。
  - **m-03**（Track.sessionIdにインデックス無し）: 純追加migration `20260727152532_add_track_session_id_index`（`CREATE INDEX "Track_sessionId_idx" ON "Track"("sessionId");`のみ、既存カラムの変更・削除なし）を追加し、テストDB・開発DB両方にmigrate deploy済み。
  - **m-04**（publicAnnotationIdsの上限なし）: 上限500件を追加（`lib/validatePublishPayload.ts`）。根拠: 実運用の注釈数（数十件程度）を妨げず、8MBボディに詰め込める数十万件は明確に弾ける値。
  - **m-05**（registerの入力検証が存在チェックのみ）: `lib/validateRegisterPayload.ts`を新規作成し、username(3〜50字・英数字/_/-のみ)・email(簡易形式チェック)・password(8〜200字)を検証。既存テストの登録データ形式（`u${tag}-${timestamp}-${random}`.slice(0,30)等）はいずれも通過することを確認済み。
  - **m-06**（本番ビルド/設定の小物）: 安全に入れられるもの2点のみ実施——① `app.disable("x-powered-by")` ② Dockerfileの`npm install`→`npm ci`化（開発・本番両ステージ。`npm ci --dry-run`でlockfile整合を確認後、`docker compose up -d --build backend`成功＋`curl localhost:8001/api/health`が200であることを実測）。**見送った項目**: prisma CLIの本番イメージ同梱可否（現状はローカルからマイグレーションを流す運用のため、Team Lead判断が必要——同梱するなら本番イメージ肥大化・同梱しないなら現状の暗黙運用継続、のトレードオフ）／root実行の是正（権限起因で起動不能になるリスクを避けるため今回は未実施）。
  - **検証**: `cd backend && npm test` → 12 suites / 121 passed / 0 failed（複数回実行し安定）。`npx tsc --noEmit`エラー0。`npm run build`成功。なお検証中に**t31-public-api.test.ts（④-e）とt99-input-boundaries.test.tsで1回ずつ無関係な単発flakeを観測**（レート制限ウィンドウ境界のタイミング起因と推測。直後の再実行では毎回121/121成功。私の変更を疑い個別に切り分けたが、変更前のHEADでも同様のflakeを確認済みのため、**今回の修正が原因ではない既知の弱さ**として記録のみ。恒久対処（時刻注入のfake timer化等）は今回のスコープ外）。
- （実装者 2026-07-28・REVIEW-backend-3.md B3-01/M3-01/M3-03/M3-05/m3-01/m3-03対応）**220行目の旧発見事項（「レート制限のIPキーはreq.ipを使用・trust proxy未設定」）は本ラウンドで解消済み**。`app.set("trust proxy", 1)`を追加し、あわせてlogin用レート制限のキー設計をIP単位からemail単位中心に変更した（`lib/rateLimiter.ts`のcheckAuthIpRateLimit/peekAuthEmailRateLimit/recordAuthEmailFailure）。判断理由: 部室の共有Wi-Fi/大学NATは反省会当日「全員が同一グローバルIP」になるため、trust proxy修正だけではB3-01は解決しない。総当たり対策の本体はemail単位10回/60秒（判定=peekと消費=recordを分離し、ログイン成功はカウントしない）とし、IP単位は60回/60秒の緩いDoSの蓋に格下げした。
  - **M3-02（register未対応）への回答**: 今回は着手せず。B3-01のemail単位キー設計はregisterにもそのまま転用できる見込み（registerには元々「アカウント」が存在しないため、email単位の代わりに「1分間に同一IPからのregister回数」でDoSの蓋をかける方式になる想定。ログイン失敗カウントのような「有効/無効な既存アカウント」区別が無い分、むしろlogin側より単純）。次回実装時はlib/rateLimiter.tsのcreateFixedWindowLimiter（peek/record分離済み）をそのまま再利用できる。
  - **M3-03（JWT_SECRETガード）の方式選択**: 「リポジトリの平文値を実行時に機械的に拾う」方式は採用しなかった。本番Dockerイメージ（backend/Dockerfileのproductionステージ）はdist/のみをコピーし、docker-compose.yml（リポジトリルート）やbackend/.env.testはイメージに含まれないため、実行時にそれらを読んでも本番の脅威（docker-compose.ymlの値をRenderにコピペする事故）を検知できない。代わりに①KNOWN_PLACEHOLDERSへ新2値を手動追加②プレースホルダ検知・長さチェックをNODE_ENV==="production"限定に変更（開発・テストの摩擦を上げない）③Dockerfileのproductionステージに`ENV NODE_ENV=production`を明記しRenderのダッシュボード設定に依存しない形にした。未設定は環境を問わず常にthrowする。
  - **B3-02（チーム加入経路なし）は今回未着手**（依頼スコープ外・オーナー判断待ち、との指示通り）。
  - **API契約変更（Codexへの申し送り）**: `POST /api/auth/login`が429を返す条件が変わった。従来「同一IPから60秒に11回目」で全員が429になり得たが、修正後は基本的に「同一emailへの連続ログイン失敗が60秒に11回目」でのみ429になる（成功ログインではカウントされない）。IP単位の緩い上限（60秒60回）はDoS対策としてのみ存在し、通常利用で踏むことは想定していない。エラーメッセージ文言は据え置き（`{error: "リクエストが多すぎます..."}`または`{error: "ログイン試行回数が多すぎます..."}`）。フロント側の429ハンドリング改善（「しばらく待てば直る」の明示）はREVIEW-backend-3.mdでも指摘されているが、frontend/には触れていないため対応していない。
- （実装者 2026-07-28・T-100 404 flaky調査）**t100-login-rate-limit.test.tsがフルスイート実行時のみ低頻度（実測1/6〜1/8程度）で「同一emailへの連続失敗」テストの初回ログインが401ではなく404を返す件を調査**。結論から言うと**機序を完全には特定できなかった**。切り分けで分かったこと:
  - `routes/auth.ts`のPOST /loginが返しうるのは429/400/401/200のみで、コード上404を返す分岐は存在しない（再読して確認済み）。
  - `index.ts`に一時的に診断ログ（`/api/auth`宛リクエストの到達ログ＋app末尾の「どのルートにもマッチしなかった」場合の捕捉ログ）を仕込んで再現を試みた。再現した失敗（`npx jest --runInBand`をフルスイートで40回超実行し2回再現）では、**「到達ログ」は出るが「未マッチ捕捉ログ」は一度も出なかった**——つまりリクエストはauthRouterまで到達し、アプリ全体の想定外フォールバック（末尾のcatch-all）には落ちていない。にもかかわらずクライアントは404を受け取っていた。
  - 失敗時のログ順序をemail付きで確認し、**t100自身の中で完結した自己矛盾のない呼び出し順**であることを確認（他ファイルのリクエストが混線していたわけではない）。失敗するのは常に「registerUser()直後、最初の誤パスワードログイン」という、直前のリクエストとの間隔が最も短い箇所だった。
  - 単独ファイル実行・2ファイル同時実行では合計40回超再現せず、フルスイート（14ファイル/133件）実行時のみ発生した。この「単体では絶対再現しないがフルスイートでは低頻度で起きる」という性質と、失敗が常に「直前のリクエストとの間隔が最短の箇所」で起きるという性質から、**supertestの`request(app)`が呼び出しのたびに`http.createServer(app)`で新しいephemeralサーバをlisten(0)し応答後にcloseするという実装（`node_modules/supertest/lib/test.js`）に起因する、サーバ生成/破棄の積み重ね由来のレース**という仮説を立てたが、確証は得ていない。
  - **対策（緩和策、確証のない原因への対症療法である点に注意）**: t100-login-rate-limit.test.tsのみ、`beforeAll`で`app.listen(0)`した実サーバを1つだけ生成し、全呼び出しで使い回す形に変更（ephemeralサーバ生成をファイル全体で約50回→1回に削減）。本番コード（`routes/auth.ts`・`index.ts`）・他のテストファイルは一切変更していない。`npm test`（2回のうち2回目、最終確認）で**14 suites / 133 passed / 0 failed**、`npx tsc --noEmit`エラー0を確認。ただし対症療法のため**Team Leadの10回連続検証で完全に解消したか要確認**（もし依然として低頻度で再現するなら、次に疑うべきは同じ仮説の延長で「他のテストファイルも同様にrequest(app)を`request(server)`パターンへ全面移行する」「supertestのバージョンアップ/代替ライブラリ検討」）。


  - **検証**: `cd backend && npm test` → **14 suites / 132 passed / 0 failed**（121から+11。実行ログ確認済み。1回だけt31-public-api.test.ts④-cで無関係な単発flakeを観測したが直後の再実行では毎回132/132成功——m-06修正コミット時にも記録されている既知の弱さで、レート制限ウィンドウ境界のタイミング起因と推測。今回の変更が原因ではない）。`npx tsc --noEmit`エラー0。`npm run build`成功。B3-01実測: `npx jest t100-login-rate-limit --runInBand`で「同一IP・異なるemail11人が全員200」「同一emailの11回目失敗が429」「15回連続成功で429にならない」の3本PASS。M3-01実測: `npx jest t95-auth-required-blocker --runInBand`で新規追加した`PUT /api/users/me`が200を返すテストがPASS。
