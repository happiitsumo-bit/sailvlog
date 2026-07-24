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
- [ ] T-12: セッションAPI（Express）
  - 成果物: ARCH.md §4のうち**セッション/トラック系エンドポイント**（POST/GET/PATCH/DELETE sessions、POST tracks、GET tracks/:id/gpx）＋`requireTeamMember`ミドルウェア＋サーバ側構造検証。GET /:id はrawGpx除外・gzip。**注釈エンドポイント（annotations系）は本タスクの対象外＝T-15の担当**
  - 検証: supertest（作成→track投稿→取得→非メンバー403→削除権限403/204、バリデーション400系）が通る。構造検証はARCH.md §4の定義どおり: `gridJson.lat.length === gridJson.lon.length === pointCount` を検証し、**gapsは点列と長さを揃えない別配列**として各要素`[start,end]`の境界（`0 ≦ start ≦ end < pointCount`）を別途検証するテストを含む
  - 依存: T-10
- [ ] T-13: 取込ウィザードUI（`/sessions/new`）
  - 成果物: 複数GPXファイル選択→lib/gpxで正規化→重ね描き簡易プレビュー（Canvas静止画で可）→艇ラベル入力→Session+Tracks保存
  - 検証: 手動: 合成GPX6本を取り込み、DB保存後 `/sessions` 一覧に出る。壊れたGPXでエラーメッセージが出て保存されない
  - 依存: T-11, T-12
- [ ] T-14: 再生エンジン＋再生ページ（`/sessions/[id]`）
  - 成果物: `lib/replay/`（ReplayClock: rAF+ref／CanvasRenderer: ローカル平面投影・艇マーカー・テール・スケールバー）＋再生/一時停止/1x/4x/8x/シークバー/艇の表示切替UI（UI同期≦10Hz）。SPIKE-01は参照のみ・コピー禁止
  - 検証: 合成6艇セッションでPC実測: 60fps近傍（DevToolsで確認）・シーク体感即応・gaps区間が破線表示。数値はTASKS追記欄に記録
  - 依存: T-12（T-13と並行可。seedデータで先行開発）
- [ ] T-15: タイムライン注釈（API＋UI）
  - 成果物: **注釈CRUD API（POST /api/sessions/:id/annotations、PATCH/DELETE /api/annotations/:id。本タスクが唯一の担当）**＋再生ページのタイムラインピン表示・現在時刻で追加（tSec自動キャプチャ、艇はタップで任意付与）・ピンクリックでシーク・一覧サイドパネル
  - 検証: supertest（権限含む）＋手動: 注釈追加→リロード後も表示→ピンからシーク
  - 依存: T-12, T-14
- [ ] T-16: 部内共有の仕上げ（URLクエリ最小＋認可確認）
  - 成果物: `?t=&boats=` の読み書き（一時停止/シーク確定時のみreplaceState）。共有ボタン（現URLコピー）
  - 検証: 別ユーザー（同Team）でURLを開くと同じ時刻・同じ艇選択で再現。非メンバーは403画面
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
- [ ] T-22: 収録ハンドブックページ
  - 成果物: `/handbook`（静的1ページ）: Geo Tracker設定手順（記録間隔最短・バックグラウンド許可）・出艇前チェックリスト・GPX取り出し方・「反省会前にURLを開いておく」（cold start対策）・「1Hz GPXが出せる手段なら何でも可」の注記
  - 検証: オーナーが読んで手順どおりに1回収録できる（並行検証の実手順と共用）
  - 依存: なし（S1と並行可）
- [ ] T-23: シードコンテンツ投入
  - 成果物: 自部の実練習1〜2本を本番へ取込み。実データで表示品質（GPSノイズ・タック視認性）を確認
  - 検証: 反省会で1回実使用し、フィードバックを「発見事項」に記録。ノイズでタック議論が困難なら「表示用スムージング」を将来→今回へ昇格判断（Team Lead協議）
  - 依存: T-17, 実データ（並行検証の収録物を流用可）
- [ ] T-24: JSONB応答の実測ガード（RQ-05・RESEARCH.md §3.6②）
  - 成果物: 実データセッションで `GET /api/sessions/:id`（6艇）の応答時間をNeon本番相手に10回計測し、結果をこのファイルに追記
  - 検証: p95 < 1s → PASSで閉じる。FAIL → ADR-002の縮退（rawGpxのbytea+gzip化 or gridJson分割）を新タスク起票
  - 依存: T-23
- [ ] T-25: スマホ閲覧調整
  - 成果物: 再生ページのレスポンシブ対応（縦画面レイアウト・タッチシーク）。B-2の結果がFAILならADR-001縮退策①〜③を適用
  - 検証: オーナーのスマホ実機で30fps以上・操作可能（B-2と同基準）
  - 依存: T-17, B-2

### S3: 仕上げ（③Quality / ④Demo Gate に向けて）

> **MVP完了集約条件（S3の着手条件。③Quality Gate・④Demo Gateの判定着手条件でもある）**
> S1・S2の全タスク（T-10〜T-17、**T-20/T-21/T-24/T-25を含む**T-20〜T-25）が完了していること。未完了タスクを残してS3へ進む場合は、**Team Leadによる明示的waive**（対象タスクID・理由・日付）をこのファイルに記録することを必須とする。waive記録なしにT-90〜T-92へ着手してはならない。

- [ ] T-90: テスト整備＋CI（qa-engineer）
  - 成果物: lib/gpx・セッションAPI・認可の回帰テストを整理し、GitHub ActionsでPush時実行
  - **品質要件（deliverablesルールをここに転記して自己完結化。外部パス `~/.claude/rules/deliverables.md` は実行環境から解決できないため）**:
    1. 製品コード（パース・API・認可等の機能実装）には**回帰を捕まえるテストを最低1本**同時に用意する
    2. 実装完了の報告には**テスト実行結果（ログ）を添付**する（「通るはず」は不可）
    3. **GitHubリモートがあるリポジトリなのでCIを組む**（GitHub Actionsでpush時にテスト実行）。リモート運用をやめた場合はCIを外し、ローカルで回せるテストコマンドをREADMEに明記する
    4. READMEまたはdocs/に**「Q&A/トラブルシューティング」セクション**を作る（本タスクではテスト/CI、Q&A本文はT-91が担当）
  - 検証: CIグリーン。カバレッジ対象=「半年後に黙って壊れたら困る」パース/認可/API契約
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

## 発見事項（実装中に見つけたスコープ外の課題）

- （実装者 2026-07-24・qa-engineer TEST-PLAN.md §6への回答）`Session.visibility`はARCH.md §3には無いが、Team Lead本人からの本セッション追加指示（知の共有層rev.4前方互換。`docs/dev-org/PRD-rev4-sharing-layer.md`参照・Annotationには追加しない）に基づく実装。ARCH.md §3への追補が必要ならarchitect側でADR/ARCH更新をお願いします
- （実装者 2026-07-24）フロントのdocker-compose volumesは`frontend/src`と`frontend/public`のみマウントで、`package.json`/`vitest.config.ts`はイメージビルド時の内容のまま更新されない。ホストでpackage.jsonを編集した後は `docker compose cp frontend/package.json frontend:/app/package.json && docker compose exec frontend npm install`、`docker compose cp frontend/vitest.config.ts frontend:/app/vitest.config.ts` が必要（container再ビルドまたはvolume追加で恒久化を検討。今回はスコープ外につき対症のみ）
- （実装者 2026-07-24）T-90のテストDB分離（`.env.test`＋`setup/env.ts`）は、`docker compose exec backend npx jest`（コンテナ内実行）だとdocker-compose.ymlが先にDATABASE_URLを開発DB向けに注入済みのため、`dotenv.config()`のデフォルト（既存env上書きしない）で`.env.test`の値が無視され、**開発DB(sailvlog_db)に対してテストが実行される**（テストDB分離が効かない）。ホスト実行・CI実行では発生しない可能性が高いが未確認。qa-engineer(T-90)へ確認・対応要否の判断を委ねる
