# DEMO-ASSETS — ホームのヒーロー画像 兼 デモ素材

<!-- 契約: 作成者 demo-director / 入力: PRD-rev8-home-experience.md §2・§4(H-6)・UI-DESIGN.md・design-system/theme.json・Issue #12・T-91 /
出力先: docs-writer（README埋め込み）・Team Lead（Demo Gate判定） -->
<!-- 位置づけ: 本ファイルは新規。docs/dev-org/ 配下の既存正本（PRD/ARCH/TASKS/UI-DESIGN/GATES）は書き換えていない。 -->

## 背景・撮影方針

PRD-rev8の3Dショーケースはオーナー裁定（2026-08-01）で静止画版へ縮小され、3Dモデル調達はリリース後に送られた。
またこの環境にはAI画像生成手段が存在しないため、素材は**実際に動いているアプリのスクリーンショット**のみで構成した。
これはホームのヒーロー画像であると同時に、「このアプリが本当に動く」ことの証拠でもある（デモ素材 Issue #12 / T-91 と兼用）。

**製品コードは一切変更していない。** ローカルDB（Docker）に demo 用アカウント・チーム・セッションを作成し、
`spike/gpx/` の合成GPXを実際のアップロードUIから投入して撮影した。

## 素材一覧

保存先: `frontend/public/screenshots/`（合計 約380KB・README掲載に十分収まるサイズ）

| ファイル名 | 画面 | 撮影条件 | 用途 | 何を証明しているか |
|---|---|---|---|---|
| `replay-hero-desktop.jpg` | リプレイ再生中（複数艇＋航跡） | デスクトップ1440x900・6艇・t=00:54:34（艇団がタックでばらけた瞬間） | 機能紹介用（ヒーロー不可＝ログイン済みUI・カーソル・見切れの写り込みあり） | 複数艇を同時再生し、色分け＋常時ラベルで識別できていること（UI-DESIGN §4.2） |
| `hero-public-replay.jpg` | 公開ビュー `/p/[slug]` のリプレイ再生中（複数艇＋航跡、艇選択・タイムラインのコントロール類含む） | デスクトップ1440x720・未ログイン状態・6艇・t=00:54:45（艇団がタックでばらけた瞬間。`replay-hero-desktop.jpg`と同等以上の広がり） | **ホームのヒーロー用** | 未ログインの部外者にも複数艇同時再生の航跡が伝わること。ログインUI（ユーザー名・Logout）・GPX選択ボタンの見切れ・マウスカーソル・スクロールバーの写り込みを排除した撮り直し版（Team Lead指摘5点の是正） |
| `replay-annotated-desktop.jpg` | 注釈が付いたリプレイ | デスクトップ・同セッション・反省メモ2件追加後 | 機能一覧「注釈」 | インライン注釈追加（モーダルなし）・タイムラインへのピン表示（UI-DESIGN §4.5） |
| `gpx-import-desktop.jpg` | GPX取込画面（艇ラベル入力後・プレビュー前） | デスクトップ・6ファイル選択済み・艇ラベルを実名風に編集済み | 機能一覧「GPX取込」 | 複数GPXの同時取込・艇ラベルの自由編集・解析OK表示 |
| `public-view-desktop.jpg` | 公開ビュー `/p/[slug]` | デスクトップ・未ログイン状態で取得したURLに直接アクセス | 機能一覧「公開共有」 | 認証不要の読み取り専用ビューが実際に動作し、公開注釈のみ表示されること（UI-DESIGN §5.3） |
| `sessions-list-desktop.jpg` | セッション一覧 | デスクトップ・2セッション（練習1・レース1） | 全体像 | 複数セッションの一覧・公開状態チップ（リンク限定） |
| `replay-hero-mobile.jpg` | リプレイ再生中 | モバイル幅（下記「モバイル幅に関する既知の制約」参照） | ホーム/デモのモバイル対応確認 | 縦画面でも複数艇の航跡が視認できること |
| `gpx-import-mobile.jpg` | GPX取込画面 | モバイル幅 | 機能一覧モバイル版 | フォームがモバイルで縦積みになること |
| `public-view-mobile.jpg` | 公開ビュー `/p/[slug]` | モバイル幅 | 機能一覧モバイル版 | 公開ビューがモバイルでも読める構成になっていること |
| `sessions-list-mobile.jpg` | セッション一覧 | モバイル幅・下部タブバー表示 | 全体像モバイル版 | ボトムタブバーへの切替（UI-DESIGN §2 スマホ変形） |

## モバイル幅に関する既知の制約（次回撮影者向け）

- `mcp__claude-in-chrome__resize_window` で `width: 390` を指定しても、このChromeインスタンスは**ウィンドウ幅を500px未満に縮小できない**（OS/ブラウザ側のウィンドウ最小幅制約とみられる）。375指定でも結果は500pxのまま変化しなかった。
- ただし500px幅でもアプリの responsive breakpoint は発火しており（下部タブバー `.ds-tabbar` 相当の表示に切替、フォームが縦積みになる等）、UI-DESIGN §2/§4.6/§7で規定された「モバイル変形」自体は実機で確認できている。
- **真の390px幅で厳密に確認したい場合**は、Chrome DevToolsのデバイスツールバー（レスポンシブモード）を手動で使うか、別の画面キャプチャ手段を検討すること。本タスクではツール制約により500px幅を「モバイル相当」として撮影した。

## デモデータ投入手順（再撮影用）

前提: `docker compose up -d db`（port 5433）が起動済みであること。

### 1. backend / frontend をローカル起動

本番の `.env` を書き換えずに、コマンド単位で環境変数を渡して起動する（AGENTS.mdの危険操作ルールに従い `DATABASE_URL` は export しない）。

```bash
# backend（別ターミナル）
cd backend
DATABASE_URL="postgresql://sailvlog_user:sailvlog_pass@localhost:5433/sailvlog_db" \
JWT_SECRET="dev-only-jwt-secret-change-me-1234567890abcdef" \
JWT_EXPIRES_IN="7d" PORT=8000 \
CORS_ORIGIN="http://localhost:3001,http://localhost:3000" \
npx ts-node-dev --respawn --transpile-only src/index.ts

# frontend（別ターミナル）
cd frontend
NEXT_PUBLIC_API_URL="http://localhost:8000" npm run dev
```

frontendは既定でport 3000、backendは8000で待受する（`docker-compose.yml`とはポート対応が異なる点に注意。Dockerコンテナ経由ではなくホストから直接 `npx`/`npm run dev` を叩く方式）。

### 2. デモアカウント・チーム作成（API直叩き。UIに作成画面がないため）

```bash
# アカウント登録
curl -s -X POST http://localhost:8000/api/auth/register -H "Content-Type: application/json" \
  -d '{"username":"demo_uploader","email":"demo-uploader@example.com","password":"demopass123"}'
# → レスポンスの token を控える

# チーム作成（架空の大学名。実在の大学名を使わない）
curl -s -X POST http://localhost:8000/api/teams -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"潮見大学ヨット部","slug":"shiomi-univ-sailing","university":"潮見大学","region":"神奈川","category":"university"}'
```

### 3. GPXアップロード（ブラウザUI経由。フロント側でGPXパース＋グリッド正規化するため）

1. `http://localhost:3000/login` で上記アカウントにログイン
2. `http://localhost:3000/sessions/new` を開く
3. TITLE/TYPE/TEAM/VENUEを入力
4. `spike/gpx/boat1_clean.gpx` 〜 `boat6_clean.gpx`（6艇分、"clean"= ノイズなしバリアント）を複数選択でアップロード
5. 各艇のラベルをデフォルトのファイル名（`boat1_clean`等）から、実在しないダミーの艇番号表記に変更する
   （本撮影で使った例: `4423 田中/佐藤` `1102 鈴木/高橋` `0091 山本/井上` `2200 中村/木村` `3311 小林/加藤` `マネ艇`。
   人名はすべて架空。実在の部員名を使わないこと）
6. プレビューCanvasで6艇のジグザグ航跡（タック）が重なって見えることを確認してから「取り込む」

### 4. 艇団が「ばらけて見える」タイミングの探し方

- 合成GPX（`spike/gen-gpx.js`生成、900m/レグでタックを繰り返す）はセッション開始直後（t=0）は全艇が同一地点に固まっている。
- リプレイ画面のタイムラインバーを**セッション後半30〜60%あたり**（本撮影は `t=3274秒`＝00:54:34、durationSec=7200秒中）でクリックすると、タックの位相が艇ごとにずれて航跡が画面いっぱいに広がる瞬間が見つかりやすい。
- マーク回航直後（レグの境目）は逆に艇団が収束するため避ける。

### 5. 注釈の追加

リプレイ画面右サイドバー「反省メモ」→「現在時刻に議論を残す」から追加。本撮影では以下の2件を追加した（架空の状況description、実在の戦術データではない）。

- `3311がここでタックが早すぎて4423に被された`
- `マネ艇の上マーク回航が良かった。風上で他艇を引き離している`

### 6. 公開昇格（`/p/[slug]` 撮影用）

リプレイ画面ヘッダの「公開する」→ 学びの要約（必須・400字以内）を入力 → 公開する注釈を選択（既定は全オフ） →
「リンクを知っている人だけ」を選択 → 「公開する」。レスポンスの `publicSlug` を使って `http://localhost:3000/p/<slug>` にアクセスすると、未ログインでも読み取り専用ビューが確認できる。

### 7. スクリーンショット撮影

`mcp__claude-in-chrome__*` ツール（`ToolSearch` で `mcp__claude-in-chrome__*` をまとめてロードしてから使用）。
デスクトップは `resize_window` で1440x900、モバイルは390指定でも実際は500px幅にクランプされる（上記「既知の制約」参照）。

### 8. `hero-public-replay.jpg` 撮影メモ（ホームのヒーロー再撮影、次回撮影者向け）

既存の `replay-hero-desktop.jpg` はログイン済みリプレイ画面を撮ったため、ホームのヒーロー用途では
「GPXを選択」ボタンの見切れ・`@demo_uploader`/Logoutの写り込み・カーソル・スクロールバー・艇チェックボックスが画面の1/3を占める、の5点をTeam Leadに指摘され不採用となった。
公開ビュー `/p/[slug]` を使えばログインUI（1・2）は構造的に発生しない。手順:

1. 既存の非公開/公開セッションを使う場合、team API・session APIで `publicSlug` を確認する（`curl -H "Authorization: Bearer <token>" http://localhost:8000/api/sessions/<id>`）。本撮影ではteam `shiomi-univ-sailing`（id=3）のsession id=2（6艇・注釈2件・`publicSlug=qvsAbeDKHTfN`）がすでに公開昇格済みだった
2. `http://localhost:3000/p/<slug>` を**新規タブ**で開く（ログイン中タブと分けるとLogoutボタン等の混入を確実に避けられる）
3. タイムラインスライダーをセッション後半45%前後でクリックし、艇団が広がる瞬間を探す（本撮影は t=00:54:45、6艇全部が分離）
4. キャンバスがビューポート上端にちょうど収まる位置まで、`javascript_tool` で `canvas.getBoundingClientRect()` を見ながら `window.scrollTo` して微調整する（マウスホイールの1 tickは粗すぎてカードの見切れ／艇マーカーの欠けが起きやすい）
5. ブラウザ純正の縦スクロールバーが写り込む場合は、撮影直前だけ `document.documentElement.style.overflow='hidden'` をJSで当てて消す（**ページのリロードやナビゲーションで自動的に元に戻る一時的なDOM操作であり、製品コード・リポジトリには一切書き込まない**）
6. `computer` の `hover` でカーソルをキャンバス外（例: 右上の黒背景部分）に退避させてからスクリーンショット

## 品質チェック結果

- [x] デモデータに `Task 1` `test` `aaa` 等のプレースホルダは一切含まれない（艇ラベルはすべて実在しない艇番号+架空の姓、チーム名は架空の大学名）
- [x] スクショに個人情報・トークン・接続文字列は映っていない（目視確認済み）
- [x] UX-AUDIT.md のBlockerが残る画面は使用していない（本タスク時点でUX-AUDIT.mdは未生成のため、代わりにUI-DESIGN.mdの実装済み画面のみを撮影対象にした）
- [x] 素材はすべて `frontend/public/screenshots/` に整理済み
- [x] 撮影に使ったセッションは非公開のローカルDBのみに存在し、本番（Neon/Render/Vercel）には一切触れていない
- [x] `hero-public-replay.jpg` は未ログイン状態・ログインUIなし・スクロールバーなし・上下の要素見切れなしで撮影
- [x] **カーソルについては撮影者の自己申告が誤りだった**（右上 x≈1405 に矢印カーソルが残存）。Team Lead が実物を見て検出し、**プレイヤー領域 (204,6)-(1237,712) で切り抜いて除去**（1440x720 → 1033x706・PIL使用・2026-08-01）。
  切り抜きのみで**画素の加工・合成・捏造は一切行っていない**。次回撮影時はカーソルを画面外またはキャンバス内の暗部へ確実に退避させること

## 未検証・今後の課題

- **真の390px幅での確認は未実施**（上記の制約により）。ホームのモバイルレイアウト最終確認時は別途DevToolsのデバイスモードで確認することを推奨する
- **サムネイル/OGP画像は未作成**。ホーム刷新（PRD-rev8）自体がオーナー承認待ち（§14項目3が未確定）のため、OGP文言・レイアウトを固めた後に着手するのが妥当と判断し、本タスクのスコープからは外した
- **30秒デモストーリー・3分版ストーリーは未作成**。今回のスコープは「実画面のスクリーンショット撮影」に限定されており、ストーリー原稿化は別タスクとして切り出すことを推奨する
