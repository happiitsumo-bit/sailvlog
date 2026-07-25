# TASKS — sailvlog v3（レースリプレイ・デバッガ E2本線）

<!-- 契約: 作成者 architect / 入力: ARCH.md / 実行者: implementer, qa-engineer -->
<!-- タスクの粒度: 1タスク = 1コミット〜1PR相当。半日を超えるタスクは分割する -->

> **用語（Codex指摘対応 2026-07-24）**: 本ファイルの実装単位は **実装スライス S0〜S3** と呼ぶ。PRD.md の「Phase 1/2」は**プロダクト展開フェーズ**（Phase 1=MVP 8週間、Phase 2=A接続・他大学展開）であり、別概念。本ファイル内で「Phase」と書くときは必ず「PRDのPhase」と明示する。

## ブロッカー（人間/外部待ち。タスクではないが着手条件になる）

| ID | 内容 | 待ち先 | ブロックする対象 |
|---|---|---|---|
| B-1 | **主役確定サブゲート**（詳細は下記セクション。2週間並行検証 → 判定記入で完了） | オーナー＋Team Lead | S1以降の〔E2〕タスク全部。**S0〔共通〕はブロックされない** |
| B-2 | **スマホ実機計測**（手順: `spike/README.md`。基準: 30fps/シーク1s/ロード5s/クラッシュなし） | オーナー | T-25（スマホ閲覧調整）と**S1完了判定**。FAIL時はADR-001の縮退策をS2に積み直す |
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
- [ ] T-13: 取込ウィザードUI（`/sessions/new`）
  - 成果物: 複数GPXファイル選択→lib/gpxで正規化→重ね描き簡易プレビュー（Canvas静止画で可）→艇ラベル入力→Session+Tracks保存
  - 検証: 手動: 合成GPX6本を取り込み、DB保存後 `/sessions` 一覧に出る。壊れたGPXでエラーメッセージが出て保存されない
  - **検証結果（2026-07-24）**: `frontend/src/app/sessions/new/page.tsx`（ウィザード本体）＋`SessionPreviewCanvas.tsx`（重ね描き静止画プレビュー、lib/replayとは別実装）を実装。lib/gpx（T-11）の`parseGpx`/`computeSessionStart`/`normalizeToGrid`をそのまま利用し、ファイル単位でパース失敗を検知してエラー表示（該当ファイルのみエラー表示・保存ボタンは全体を無効化＝壊れたGPXが1本でもあれば保存されない）。T-12のAPI契約どおり`POST /api/sessions`→各艇`POST /api/sessions/:id/tracks`の順で保存し、成功後`/sessions?teamId=`へ遷移。T-13検証で要求される一覧確認のため、範囲内の最小ページとして`/sessions`（一覧）も同時に実装（ARCH.md §4のフロント主要ページ一覧に記載済みのページ）。teamIdはGET /api/teams（既存公開エンドポイント）から選択する方式（「自分のチーム」を返す専用APIが存在しないため。questions/newのboatType選択と同じパターン）。**この環境にDocker/PostgreSQLが無くbackendコンテナ（DNS名`backend`）に到達できないため、ブラウザでの実POST（DB書き込み込み）のE2E手動確認は実施不可**。実施した検証: ①`npx tsc --noEmit`エラー0 ②`npm run build`成功（`/sessions`, `/sessions/new`とも生成される動的ルートとして出力を確認） ③既存`npx vitest run`（lib/gpx T-11テスト10件）全PASS＝回帰なし ④一時テスト（コミット対象外・実行後削除）でqa-engineer用意の6艇fixture（`__fixtures__/boat1〜6_clean*.gpx`）を実際に`parseGpx`→`computeSessionStart`→`normalizeToGrid`に通し、ウィザードと同じ計算（durationSec=18、6グリッドとも`lat.length===lon.length===pointCount`）が成立することを確認。**DB書き込みを伴うE2E（GPX取込→`/sessions`一覧表示→壊れたGPXでの保存拒否の実ブラウザ確認）はCIで検証**（GitHub ActionsでのDocker+Postgres環境が前提。T-90でCI構築時にこのシナリオのE2Eテストを含めることを推奨）
  - 依存: T-11, T-12
- [ ] T-14: 再生エンジン＋再生ページ（`/sessions/[id]`）
  - 成果物: `lib/replay/`（ReplayClock: rAF+ref／CanvasRenderer: ローカル平面投影・艇マーカー・テール・スケールバー）＋再生/一時停止/1x/4x/8x/シークバー/艇の表示切替UI（UI同期≦10Hz）。SPIKE-01は参照のみ・コピー禁止
  - 検証: 合成6艇セッションでPC実測: 60fps近傍（DevToolsで確認）・シーク体感即応・gaps区間が破線表示。数値はTASKS追記欄に記録
  - **検証結果（2026-07-24）**: `frontend/src/lib/replay/`（`geo.ts`=投影＋gaps判定の純関数、`ReplayClock.ts`=rAF+ref時刻管理、`CanvasRenderer.ts`=命令的描画、いずれも新規実装・spike/はコード参照のみで未コピー）＋`frontend/src/app/sessions/[id]/page.tsx`（再生ページ）を実装。UIパネル同期はrAFループ内で100ms間隔（=10Hz）に間引き、シーク操作のみ即時反映。
    - ①ユニットテスト: `t14-replay-engine.test.ts`（computeProjection/project/isIndexInGap/splitByGapRuns の純関数11件＋ReplayClockのplay/pause/speed/clamp/自動停止）全PASS（`npx vitest run`）
    - ②`npx tsc --noEmit`エラー0・`npm run build`成功（`/sessions/[id]`が動的ルートとして生成される）
    - ③**実ブラウザでの性能実測**: この環境にDocker/PostgreSQLが無くbackendに接続できないため、SPIKE-01のgen-gpx.js（使い捨てスクリプト、コピー不可の対象外＝データ生成のみでロジックは含まない）で実規模データ（2時間・1Hz・6艇・7200点/艇、うち1艇に30秒ギャップ2箇所）を生成し、T-11の本番`parseGpx`/`normalizeToGrid`で正規化した上で使い捨てのモックAPIサーバ（Node標準httpのみ・新規依存なし・コミット対象外）に載せ、Playwright（環境にプリインストール済み）で`/sessions/[id]`を実ブラウザ（Headless Chromium）で操作して計測。結果: 再生中のrAFフレーム間隔が1x/4x/8xいずれもp50=p95=16.7ms・平均60.0fps（ディスプレイ同期16.7msに張り付き＝描画コストがフレーム予算に対して無視できるレベル。SPIKE-01のPC実測=render p95 0.2msと整合）。シーク応答（値変更→2rAF後の再描画完了まで）は17〜31ms（4サンプル、目標「シーク1秒以内」に対し十分高速）。gaps区間の破線表示はスクリーンショット（ズーム）で目視確認済み（艇3・tSec=1810=gap[1800,1829]内で実線→破線への切り替わりを確認）。console errorは1件（`ERR_CONNECTION_RESET`、モックサーバ未提供の付随リソース起因と推定・再生ロジックと無関係）
    - 艇の表示切替（チェックボックスでON/OFF）・シークバー・速度切替(1x/4x/8x)は同スクリーンショット/操作で動作確認済み
  - 依存: T-12（T-13と並行可。seedデータで先行開発）
- [ ] T-15: タイムライン注釈（API＋UI）
  - 成果物: **注釈CRUD API（POST /api/sessions/:id/annotations、PATCH/DELETE /api/annotations/:id。本タスクが唯一の担当）**＋再生ページのタイムラインピン表示・現在時刻で追加（tSec自動キャプチャ、艇はタップで任意付与）・ピンクリックでシーク・一覧サイドパネル
  - 検証: supertest（権限含む）＋手動: 注釈追加→リロード後も表示→ピンからシーク
  - **検証結果（2026-07-24）**: `backend/src/lib/validateAnnotationPayload.ts`（tSec∈[0,durationSec]・body≦2000字の構造検証）＋`backend/src/routes/sessions.ts`に`POST /:id/annotations`追加＋新規`backend/src/routes/annotations.ts`（`PATCH/DELETE /api/annotations/:id`、author本人 or Team adminのみ＝`requireTeamMember.ts`に追加した`isAuthorOrTeamAdmin`で判定）。フロントは`frontend/src/app/sessions/[id]/page.tsx`にタイムラインピン（シークバー直下、`tSec/durationSec`の位置にクリック可能な丸ボタン、クリックでシーク）・現在時刻に注釈追加するフォーム（艇の任意紐付けはタップ操作ではなくプルダウン選択に簡略化＝UI実装上の裁定で、ARCH変更ではない）・注釈一覧サイドパネル（クリックでシーク）を追加。
    - **この環境に実はPostgreSQLがローカルインストール済み（apt: postgresql-16、Docker不要）と判明** — サービス起動（`service postgresql start`）→`sailvlog_user`ロール作成→`.env.test`のDATABASE_URLをポート5432に向けて`npm test`を実行し、**モックなしの実DB統合テスト**でT-12〜T-15を再検証: `backend/src/__tests__/t15-annotations-api.test.ts`（新規12件: 正常系201・tSec範囲外400・body超過400・非TeamMember403・未認証401・他セッションtrackId400・author本人PATCH200・Team adminPATCH200・非author非adminPATCH403・author本人DELETE204(カスケード確認)・非author非adminDELETE403・存在しないID404）を含むbackend全体`npm test -- --runInBand`が **6 suites / 48 passed(todoの27件を除く全件)/ 0 failed** で通ることを確認（実行ログはこのコミット時点で確認済み。再現手順は発見事項に記録）
    - フロント側は`npx tsc --noEmit`エラー0・`npm run build`成功（`/sessions/[id]`にピン/フォーム/一覧の分だけバンドルサイズ増加を確認、機能追加以外の異常なし）
    - 手動UIの実ブラウザE2E（注釈追加→リロード後も表示→ピンからシーク）は、検証中にセッションのワーカープロセスが再起動され一度中断したが、**T-16の検証時に同じ手順で再実施し完了**（`annotationVisibleAfterReload=true`。詳細はT-16の検証結果欄）
  - 依存: T-12, T-14

> **T-13/T-14/T-15 の完了取り消し（2026-07-25 §7再点検）**
> 完了マークは2026-07-24時点のもので、UI-DESIGN §7「実装時の必須修正」10項目（本ファイル注記7で完了条件に昇格したのは2026-07-25＝**マーク後**）に対する点検を経ていない。
> 実装コードを10項目に照らして再点検した結果は以下。**3件充足・7件未達**のため、機能面のみの完了マークを取り消す。
>
> | # | §7項目 | 判定 | 根拠 |
> |---|---|---|---|
> | 1 | セッションカードのリンク化 | OK | `sessions/page.tsx` カード全体が`<Link>` |
> | 2 | モバイルDOM順 | 未達 | レグUI自体が未実装（T-25）。比較（艇の表示）がメモ入力より後ろ（`aside`が最後） |
> | 3 | スクラブのキーボード操作 | **修正済** | `input[type=range]`で操作可能だったが±1秒刻みだったため、←→=±5秒／Shift=±30秒を実装＋`aria-valuetext` |
> | 4 | ファイル入力 | 未達 | 実`<input type="file">`＋`<label for>`はOK（a11yは充足）だが、§2のドロップゾーンUI自体が未実装 |
> | 5 | labelの関連付け | OK | `s-title`/`s-type`/`s-team`/`s-venue`/`s-gpx`に`htmlFor`、艇ラベルは`aria-label` |
> | 6 | ステータス通知 | **修正済** | `role`が1つも無く、共有失敗時に`window.prompt()`（ブロッキングダイアログ）を使っていた。`role="status"`/`role="alert"`へ置換し`prompt()`を撤去 |
> | 7 | 操作対象サイズ24px | **修正済** | 注釈ピンが8×8pxのまま。透明ヒット領域24×24pxに拡張＋`aria-label` |
> | 8 | 色以外の識別 | 未達 | `CanvasRenderer`は色のみで艇を識別（`setLineDash`はギャップ表現用で艇識別ではない）。常時ラベルなし |
> | 9 | ダークテーマのコントラスト | **前提解消（本体は引き続き未達）** | 2026-07-25「DS適用」でDS rev.3自体をfrontendへ適用済み（下記参照）。Canvas背景の生hex・`BOAT_COLORS`独自8色は解消。ただし§7 #9が本来求める「accent上の白文字コントラスト調整」自体はDSトークン側の是正であり本タスクの対象外のため**未実施**（下記DS適用ログ参照） |
> | 10 | `<html lang="ja">` | **修正済** | `layout.tsx`が`lang="en"`のままだった |
>
> - 2026-07-25のコミットで修正したのは 3・6・7・10（検証: `npx tsc --noEmit`エラー0／`npx vitest run` 21件PASS／`npm run build`成功）。
> - **残り（2・4・8）を満たした時点で再度[x]にする**（9は下記の通り前提のみ解消・本体は別途）。
> - 未整備の検証手段: frontendに`@testing-library/react`が無く、a11y属性の回帰を自動で捕まえられない。導入をT-90（CI）に含める。
>
> **DS適用（2026-07-25・implementer/T-26と同時実施）**: `frontend/src/app/globals.css`の`:root`トークンをdesign-system/styles.css・theme.json準拠の値に差し替え（旧v1"Claude-paper"の変数名はDSトークンへのエイリアスとして残し、`.form-page`/`.container`/`.btn`等の既存クラスは無改造で配色だけ差替）。外部フォント読み込み（Google Fonts）を撤去しDS指定のシステムフォントスタックへ統一。`prefers-color-scheme`・`[data-theme]`によるダークテーマトークンを新規追加（旧globals.cssにはダークモードが存在しなかった）。`CanvasRenderer.ts`の`BOAT_COLORS`独自8色をDSの`--color-boat-1..4`（ダーク値）に統一しスケールバー色もDS水面上インク相当に変更。`sessions/[id]/page.tsx`のリプレイCanvas背景を生hex`#eef3f5`から`var(--gradient-water-deep)`に変更（UI-DESIGN §4「常時ダークな海図面」に一致）。`sessions/new/SessionPreviewCanvas.tsx`の同種の生hex背景・独自色もgetComputedStyle経由のDSトークン読み取りに変更（この画面は常時ダークではないためライト/ダーク双方に追従）。検証: `npx tsc --noEmit`エラー0／`npx vitest run`23件PASS／`npm run build`成功／`next start`+claude-in-chromeで`/login`・`/handbook`を実描画確認（DSアクセント色反映・コンソールエラー0件）。
>   - **§7 #9本体（accent色のコントラスト是正）は未実施**: `--color-accent`のdark値(#2f9fd1)は白文字との組でコントラスト比3.0:1（design-system/theme.json記載の既知値）。UI-DESIGN §7 #9の指示どおり「DSトークン側の修正はdesign-system更新として1コミットで行う」対象であり、本タスク（frontend適用）のスコープ外のため据え置き。対応要否・実施担当はTeam Lead/architect判断を仰ぐ。

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

- [ ] T-20: 2艇比較ハイライト
  - 成果物: 2艇を選ぶと他艇が減光・選択艇が強調（**間隔距離(m)のライブ表示はMVPから除外**=Codexレビュー2026-07-24のYAGNI指摘採用。PRD §5の要件は「2艇ハイライト比較」のみで距離表示は含まない。反省会で距離の需要が実証されたら将来タスクとして起票）
  - 検証: **6艇合成GPXフィクスチャ**（SPIKE-01流用）で2艇の選択/解除を切り替えながら再生し、**PCでChrome DevTools Performanceパネル計測により55fps以上を維持**すること。計測値をこのファイルに追記
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
- [ ] T-26: v2フロント画面の削除（オーナー裁定 2026-07-25・PRD §5「v2フロント画面の扱い」）
  - 成果物: 凍結済みv2画面（articles/questions/feed/learn/reference等のページ・専用コンポーネント・navigation設定・検索UI）をフロントから削除。ログイン/登録は存続（遷移先を`/sessions`へ変更・UI-DESIGN §1）。layout.tsxの説明文言とmetadata・`<html lang="ja">`をv3の実態に更新
  - 前提: **削除前にアーカイブブランチ `archive/v2-frontend` が存在すること**（バックアップはgitブランチ。裁定は「隠す」でも「即削除」でもなく「ブランチ保存の上で削除」）
  - 検証: `npm run build` 成功＋残存ページから削除ページへのリンク切れゼロ（grepでhref確認）＋ログイン→/sessions遷移がE2Eで通る
  - **検証結果（2026-07-25）**: `articles/questions/feed/learn/reference/boat/tag/teams/sailors/users`の全ページ・専用コンポーネント（ArticleCard/BookmarkButton/LikeButton/IntelligenceFeed/PickUpReference/ReferenceCard/ReferenceSidebar/RelatedReferences/ClassFocusTile/ClassFlag/ClassSidebar/RightSidebar/CommandPalette/CommandPaletteProvider/未使用だった旧Navbar/SkeletonCard）・検索UI・`lib/mock-references.ts`を削除（`archive/v2-frontend`へ退避済みの内容と同一。前提のアーカイブブランチは`git branch`で存在確認済み、作り直していない）。ログイン/登録は存続し成功後の遷移先を`/sessions`へ変更（UI-DESIGN §1）。ルート`/`はv2 Bentoホームを廃し、ログイン状態で`/sessions`or`/login`へ振り分ける入口に縮小。layout.tsxのmetadata（title/description）とナビ（Sessions/Handbookの2項目）を更新、`<html lang="ja">`は既存のまま維持。TopBarは検索コマンドパレットを除去しログアウトボタンに変更。login/register未対応だった§7 #5(label htmlFor)・#6(role="alert")もあわせて適用。
    - ①`npx tsc --noEmit`エラー0 ②`npx vitest run`23件PASS（回帰なし、T-11/T-14のテストのみで元々v2ページのテストは無かった） ③`npm run build`成功、ルートが19→8（`/`, `/_not-found`, `/handbook`, `/login`, `/register`, `/sessions`, `/sessions/[id]`, `/sessions/new`）に縮小 ④`grep -rn 'href="/\(articles\|questions\|feed\|learn\|reference\|boat\|tag\|teams\|sailors\|users\)'` 0件（削除ページへのリンク切れなし） ⑤**ログイン→/sessions遷移の実E2E**: この環境はDocker Desktopが稼働しておりdocker-compose（`sailvlog-frontend-1`/`sailvlog-backend-1`/`sailvlog-db-1`、bind mountでホストの変更を即反映）が別セッションにより起動済みだったため、それをそのまま使い実ブラウザ（claude-in-chrome）で検証: `POST /api/auth/register`でテストユーザー作成→`/login`で実際にフォーム入力しログインボタンをクリック→URLが`http://localhost:3001/sessions`へ遷移し、Sessionsページ（チーム選択・Import GPXボタン）が表示されることを確認（`/sessions`の認証ガードがログイン失敗時は`/login`へ即戻す実装のため、遷移が保持された時点でログイン成功も確認済み）
  - 依存: T-13, T-14（/sessionsが存在しない状態で消すと空アプリになるため）
- [ ] T-25: スマホ閲覧調整
  - 成果物: 再生ページのレスポンシブ対応（縦画面レイアウト・タッチシーク）。B-2の結果がFAILならADR-001縮退策①〜③を適用
  - 検証: オーナーのスマホ実機で30fps以上・操作可能（B-2と同基準）
  - 依存: T-17, B-2

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
- [ ] T-32: 昇格ダイアログUI〔共有1〕
  - 成果物: `/sessions/[id]` に「公開する」ボタン（権限保持者のみ描画）＋昇格ダイアログ（学びの要約テキストエリア＝残り文字数表示・必須／注釈チェックリスト＝**既定全オフ**＋「反省会のメモは既定で非公開です」の説明文／公開範囲ラジオ2択＋「リンクを知っている人は誰でも見られます」の明記／**「航跡の先頭・末尾に陸上の移動が含まれていないか確認してください」の注意書き**＝PRD第7リスク②）。公開済みは「公開URLをコピー」「公開をやめる」に切替。`/sessions` 一覧とリプレイ画面に「公開中」/「リンク限定」チップ
  - 検証: UI-DESIGN §7の10項目を満たす（label関連付け・`role="status"`・24pxタップ対象・`alert()`不使用）。手動: 非権限ユーザーにボタンが出ない／要約未入力で確定できない／既定でチェックが1つも入っていない
  - 依存: T-30, UI-DESIGN rev.5 §5
- [ ] T-33: 公開ビュー `/p/[slug]`〔共有1〕
  - 成果物: 認証不要の読み取り専用ページ。`lib/replay/` を**そのまま再利用**（描画コードを分岐も複製もしない）。学びの要約→Canvas→再生コントロール→タイムライン（公開注釈のみピン）→公開メモ一覧→「sailvlogとは」説明ブロックの順。編集系UI（メモ追加・公開ボタン・削除）は**描画しない**
  - 検証: 手動/E2E: ログアウト状態で開ける／非公開注釈がDOMにもレスポンスにも出ない／編集UIが存在しない／スマホ縦画面で崩れない
  - 依存: T-31, T-14（再生エンジン）
- [ ] T-34: OGP＋公開E2E〔共有1〕 — **ここで共有1完成**
  - 成果物: `/p/[slug]` の `generateMetadata`（title・description=学びの要約冒頭100字・`og:image`=静的1枚・`unlisted` は `robots: noindex`）＋静的OG画像1枚（海図面＋ロゴ。動的生成はバックログ）
  - 検証: E2E通し — 部内で昇格 → ログアウト状態でURLを開く → 公開注釈のみ表示 → メタタグをHTMLで確認（`og:title`/`og:description`/`og:image`/`noindex`の有無が範囲で切り替わる） → 「公開をやめる」→ **同じURLが404** → 再公開で別URLが発行される。結果をこのファイルに追記
  - 依存: T-32, T-33

### S3: 仕上げ（③Quality / ④Demo Gate に向けて）

> **MVP完了集約条件（S3の着手条件。③Quality Gate・④Demo Gateの判定着手条件でもある）**
> S1・S2の全タスク（T-10〜T-17、**T-20/T-21/T-24/T-25を含む**T-20〜T-25）**および S2.5（T-30〜T-34）** が完了していること（S2.5はPRD rev.6でPhase 1に内包されたため、Quality/Demo Gateの対象に含む）。未完了タスクを残してS3へ進む場合は、**Team Leadによる明示的waive**（対象タスクID・理由・日付）をこのファイルに記録することを必須とする。waive記録なしにT-90〜T-92へ着手してはならない。
>
> **【Team Lead waive 記録 2026-07-25】** S2.5冒頭の waive 記録と**同一の対象・同一の理由**で、S3の集約条件についても waive する（対象: T-02・T-17・T-23・T-24・B-2＝T-25の実機計測部分／理由: B-3未作成と実艇練習という外部・人間依存／オーナー確認: セッション内AskUserQuestion回答 2026-07-25）。
> なおT-90のCIは、GitHubリモート（`origin` = happiitsumo-bit/sailvlog）が存在するため**deliverablesルールどおり構築対象に含む**（デプロイ許可とCI構築は別物）。

- [ ] T-90: テスト整備＋CI（qa-engineer）
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
  - 依存: MVP完了集約条件（上記）
- [ ] T-92: リリース＋計測準備（release-manager）
  - 成果物: PRD §6の成功指標①〜③を数えるSQL（アップロード数・注釈数の集計クエリ）をdocsに記載。knowledge還流（RESEARCH.md §5の候補を/tilへ）
  - 検証: SQLがNeon上で動き数値が返る
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
- （実装者 2026-07-24・T-15）**このセッション実行環境にはPostgreSQL 16がaptでローカルインストール済み**（`/usr/lib/postgresql/16/bin/`, `service postgresql start/stop`で起動可能。Dockerデーモンは無いが、Docker越しでなく直接Postgresが使える）。手順: ①`service postgresql start` ②初回のみ`sudo -u postgres psql -c "CREATE ROLE sailvlog_user WITH LOGIN PASSWORD 'sailvlog_pass' SUPERUSER;"` ③`.env.test`はポート5433(docker-compose想定)を指しているため、実行時に`DATABASE_URL=postgresql://sailvlog_user:sailvlog_pass@localhost:5432/sailvlog_test npm test -- --runInBand`のように**ポート5432で上書き**する（`.env.test`ファイル自体は変更しない。dotenvは既存env変数を上書きしないため有効）。これで`backend`のsupertestが**モックなしの実DB統合テスト**として通る。T-90（CI構築）はGitHub Actions側でpostgres serviceコンテナ（5433）を使う前提のままでよいが、**日々のローカル検証はこの手順で「DBが無いのでユニットテストのみ」を避けられる**ので、次回以降のセッションでも先にこの手順を試すことを推奨（ダメならこれまで通りモック/ユニットテストのみに縮退）
- （実装者 2026-07-24・T-15）上記の発見を活かし`frontend`側も実backend（`npm run dev`, DATABASE_URL=sailvlog_db）に対してPlaywrightで手動UIフロー（取込→再生→注釈→リロード→ピンシーク）を検証しようとしたが、**検証スクリプト実行中にこのセッションのワーカープロセスが再起動され**、Postgresサービス・next/backendのbackgroundプロセスが失われて中断した（コード変更は無事・失われたのは検証作業のみ）。再現手順: ①`service postgresql start` ②`sudo -u postgres createdb -O sailvlog_user sailvlog_db`（初回のみ）③`DATABASE_URL=postgresql://sailvlog_user:sailvlog_pass@localhost:5432/sailvlog_db npx prisma migrate deploy`(backend/) ④`DATABASE_URL=...sailvlog_db JWT_SECRET=dev_local_secret PORT=8000 CORS_ORIGIN=http://localhost:3100 npm run dev`(backend) ⑤`curl -X POST localhost:8000/api/auth/register`でユーザー作成→`psql`で`Team`/`TeamMember`行を直接INSERT（teams作成の公開APIが無いため） ⑥`API_URL=http://localhost:8000 npm run start -- -p 3100`(frontend, 事前に`npm run build`済みであること) ⑦Playwright（`/opt/node22/lib/node_modules/playwright`, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`）でlocalStorageにtoken/userをセットして`/sessions/new`から操作。次回セッションでこの手順を再実行すればT-13〜T-16の手動UI検証を実DBで完了できる

- （実装者 2026-07-24・T-14）Docker/PostgreSQLが無い環境でも`/sessions/[id]`等の実ブラウザ性能検証を行う手順を確立: ①`spike/gen-gpx.js`で実規模GPXを生成→②`lib/gpx`の本番パーサでJSON化→③Node標準httpのみの使い捨てモックAPIサーバ（`GET /api/boat-types`等の空応答＋対象エンドポイントのフィクスチャ応答、CORS対応必須）→④`NEXT_PUBLIC_API_URL`と`API_URL`を同じ値にして`next build && next start`（**NEXT_PUBLIC_*はビルド時埋め込みのため`next start`時にセットしても効かない点に注意**）→⑤環境にプリインストール済みのPlaywright（`/opt/node22/lib/node_modules/playwright`、`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`）でHeadless Chromiumから操作・計測。T-20（2艇比較55fps計測）・T-25（スマホ想定のviewport計測）でも同じ手順が使い回せるはずなので記録しておく（本番コード・テストには含めていない使い捨て手順のため、必要なら次回実装者がscratchpadで再構築する）

- （実装者 2026-07-24・T-13）ログインユーザーが「自分の所属チーム」を取得するAPI（例: `GET /api/users/me`にteamMembers含める）が存在しない。ARCH.md §4はteamId選択の実装方法まで規定していないため、`/sessions/new`・`/sessions`一覧とも`GET /api/teams`（既存公開エンドポイント・全チーム一覧）から選択する方式で実装（questions/newのboatType選択と同じパターン）。非メンバーのチームを選んでもPOST /api/sessionsが403を返すため実害はないが、UXとしては「自分のチームだけ出す」方が親切。ARCH変更が必要な提案のため実装者判断では追加せず記録のみ（対応要否はarchitect/Team Lead判断）
- （実装者 2026-07-24・T-13）取込ウィザードで複数艇のtracks投稿が途中失敗した場合（例: 3艇目のPOSTがネットワークエラー）、Sessionは作成済みのまま一部Trackのみ保存された不完全な状態が残る（トランザクション/ロールバックの仕組みがAPI契約にない）。頻度は低いと見積もるが、発生時はユーザーがそのSessionを手動削除して再取込する以外の回復手段がない。API側にトランザクション化や「tracks一括投稿」エンドポイントを足すのはARCH.md §4のI/F変更にあたるため実装者判断では行わず記録のみ

- （実装者 2026-07-24・qa-engineer TEST-PLAN.md §6への回答）`Session.visibility`はARCH.md §3には無いが、Team Lead本人からの本セッション追加指示（知の共有層rev.4前方互換。`docs/dev-org/PRD-rev4-sharing-layer.md`参照・Annotationには追加しない）に基づく実装。ARCH.md §3への追補が必要ならarchitect側でADR/ARCH更新をお願いします
- （実装者 2026-07-24）`docker compose exec backend npx jest`（デフォルト＝複数ワーカー並列実行）で、qa-engineerのグローバルフック`resetDbHook.ts`（各testの前にDB全体をTRUNCATE）と複数テストファイルの並列実行が競合し、まれに「ユーザーが存在しない」等のFK違反で失敗することを確認（t12-sessions-api.test.ts等では再現・非再現があり、`--runInBand`（直列実行）では常に全PASS）。ロジックバグではなく共有テストDB×並列ワーカーのレース。CI/ローカルで`jest --runInBand`をデフォルトにするか、テストDBをワーカーごとに分離するかの対応要否をqa-engineer(T-90)に判断を委ねる
- （実装者 2026-07-24）フロントのdocker-compose volumesは`frontend/src`と`frontend/public`のみマウントで、`package.json`/`vitest.config.ts`はイメージビルド時の内容のまま更新されない。ホストでpackage.jsonを編集した後は `docker compose cp frontend/package.json frontend:/app/package.json && docker compose exec frontend npm install`、`docker compose cp frontend/vitest.config.ts frontend:/app/vitest.config.ts` が必要（container再ビルドまたはvolume追加で恒久化を検討。今回はスコープ外につき対症のみ）
- （実装者 2026-07-24）T-90のテストDB分離（`.env.test`＋`setup/env.ts`）は、`docker compose exec backend npx jest`（コンテナ内実行）だとdocker-compose.ymlが先にDATABASE_URLを開発DB向けに注入済みのため、`dotenv.config()`のデフォルト（既存env上書きしない）で`.env.test`の値が無視され、**開発DB(sailvlog_db)に対してテストが実行される**（テストDB分離が効かない）。ホスト実行・CI実行では発生しない可能性が高いが未確認。qa-engineer(T-90)へ確認・対応要否の判断を委ねる
