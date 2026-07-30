# sailvlog — 反省会リプレイ・デバッガ

[![test](https://github.com/happiitsumo-bit/sailvlog/actions/workflows/test.yml/badge.svg)](https://github.com/happiitsumo-bit/sailvlog/actions/workflows/test.yml)

> **大学ヨット部の反省会を、記憶とホワイトボードから「航跡データ」へ置き換える。**
> 複数艇のGPXを取り込み、同じ時間軸で再生し、気づいた瞬間にタイムラインへ注釈を残して部内で共有する。

**[ここにデモGIF/スクリーンショットが入ります — demo-director 作業待ち。挿入までは `/sessions/[id]` を実際に開いて確認してください]**

---

## なぜ作ったか

このリポジトリはもともと「セーラー向けナレッジシェアSNS」（記事・Q&A・フィード・学習コース）として作られていましたが、**「機能を寄せ集めただけで、誰の何の課題を解いているか説明できない」**という自己診断（v1批判）を経て、**v3としてピボット**しました。

v3が解くのは1つだけです。大学ヨット部の週次反省会で、艇のGPS航跡を並べて見ながら「あのタックはどうだった」を議論し、その気づきを次の代へ引き継ぐこと。機能を足すより、この1本の体験を最後まで太くすることを優先しています。

ピボットの意思決定の経緯は以下に記録されています。

- [`docs/dev-org/PRD.md`](docs/dev-org/PRD.md) — 何を作り、何を作らないか（企画の正本）
- [`docs/dev-org/GATES.md`](docs/dev-org/GATES.md) — 各工程の人間承認の記録
- [`docs/dev-org/ARCH.md`](docs/dev-org/ARCH.md) — 技術設計とADR
- [`docs/dev-org/TASKS.md`](docs/dev-org/TASKS.md) — 実装タスクと進捗（現在地はここが正本）

## 主な機能

- **GPX取込＆複数艇同時再生** — 練習・レースで複数艇が記録したGPXをまとめてアップロードすると、同じ時間軸に正規化して重ね描き再生できる（`/sessions/new` → `/sessions/[id]`）
- **タイムライン注釈** — 再生中の任意の瞬間に気づきをピン留めでき、後からクリックしてその時刻へシークし直せる
- **部内URL共有** — 再生位置・表示艇の状態をURLに埋め込んで共有し、同じチームの別メンバーが同じ画面を開ける
- **収録ハンドブック** — GPSロガー（Geo Tracker等）の設定手順・出艇前チェックリスト・取込手順をログイン不要で読めるページ（`/handbook`）
- **部外向け公開ビュー** — セッション所有者・Team adminが「学びの要約」を添えて昇格すると、認証不要で開ける読み取り専用ページ `/p/[slug]` が発行される。非公開の注釈・編集UIは一切露出せず、OGP（`unlisted`は`noindex`）にも対応（機能はローカルで完成済み。**本番デプロイはまだのため、外部からアクセスできるインターネット上の公開URLは現時点で存在しない** — 詳細は下記「デプロイについて」）

## 部外向け共有（公開ビュー）の使い方

1. `/sessions/[id]` の再生画面で「公開する」ボタン（uploader本人 または Team adminにのみ表示）を押す
2. ダイアログで「学びの要約」を入力する（**必須**。空または空白のみでは確定できない）
3. 公開してよい注釈にチェックを入れる（**既定では全ての注釈が非公開**。反省会のメモを誤って公開しない設計）
4. 公開範囲を選ぶ（「リンクを知っている人は誰でも見られる」= unlisted / 検索エンジンにも出す = public）。「航跡の先頭・末尾に陸上の移動が含まれていないか確認してください」の注意書きが出るので、GPS収録の前後がログの取り忘れで陸上を含んでいないか確認してから確定する
5. 確定すると公開URL（`/p/[slug]`）が発行され、ヘッダのボタンが「公開URLをコピー」に切り替わる。`/sessions` 一覧・再生画面には「公開中」（public）/「リンク限定」（unlisted）のチップが表示される
6. コピーしたURLはログアウト状態でも開ける。学びの要約→航跡再生→公開注釈のみのタイムライン→「sailvlogとは」の順で表示され、編集系UI（メモ追加・削除・公開ボタン）は出ない
7. 「公開をやめる」を押すと同じURLは以後404になる。再度公開すると**別の新しいURLが発行される**（旧URLは復活しない）

## 技術スタック

| 領域 | 技術 | 選定理由 |
|---|---|---|
| Frontend | Next.js 14 (App Router) / React / TypeScript | 型安全なままSSR/CSRを使い分けられ、部内限定〜将来の公開ページ追加まで1リポジトリで完結させたかった |
| 描画 | Canvas（命令的描画・自前実装） | 複数艇×数千点のリプレイをフレーム落ちなく描く要件に対し、汎用地図ライブラリより制御しやすいと判断（`docs/dev-org/ARCH.md` のADR参照） |
| Backend | Node.js / Express / TypeScript | 認証・チーム管理などv1の基盤をそのまま引き継げる構成 |
| DB | PostgreSQL / Prisma ORM | GPX由来の時系列データ（JSONB）とリレーショナルなチーム/権限モデルを1つのDBで両立 |
| 開発環境 | Docker / Docker Compose | 「新規メンバーが `docker compose up` だけで動かせる」を優先し、ローカルのNode/PostgreSQLバージョン差異を吸収 |
| CI | GitHub Actions | pushのたびにbackend/frontendのテスト・型チェック・ビルドを自動実行（後述） |
| 新規依存 | ゼロ（GPXパース・リプレイエンジンとも自前実装） | 「新技術予算を将来のPhaseのために温存する」という設計方針（ARCH.md §1） |

## セットアップ（ローカル開発）

前提: Docker / Docker Compose が使えること。

```bash
git clone https://github.com/happiitsumo-bit/sailvlog.git
cd sailvlog
cp .env.example .env      # 値はローカル用のデフォルトのままでOK
docker compose up -d
```

起動後:

| サービス | URL |
|---|---|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:8001 |
| PostgreSQL | localhost:5433（コンテナ間は `db:5432`） |

> **ポート番号に注意**: `docker-compose.yml` はホスト側を `3001`/`8001`/`5433` にマッピングしています（コンテナ内部はそれぞれ `3000`/`8000`/`5432`）。`.env.example` の `NEXT_PUBLIC_API_URL` も `8001` 前提です。

初回のみ、コンテナ内の依存関係が package.json と食い違っていることがあります（下記Q&A参照）。その場合は:

```bash
docker compose exec backend npm install
```

動作確認（実際に実行して確認済み）:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/login   # → 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8001/api/teams  # → 200
```

## テストの実行

> **重要（2026-07-28 更新）**: backendのテストは **ホスト側から実行**します。`docker compose exec backend npm test` は**意図的に失敗する設計**になりました（理由は下の「テスト運用のルール」参照）。

```bash
# backend（Jest。DBはdocker-composeのdbサービスをホストの5433経由で使用）
cd backend && npm test

# frontend（Vitest。GPX/リプレイエンジンの純関数テスト）
cd frontend && npm test

# frontendの型チェック・ビルド確認
cd frontend && npx tsc --noEmit && npm run build
```

実行結果（2026-07-28 検証時点・Team Lead が10回連続実行して確認）:

- backend: `14 suites / 133 passed / 0 failed`（所要 約40秒）
- frontend: `6 files / 55 passed`

### テスト運用のルール（守らないと壊れます）

1. **テストは同時に2つ以上走らせない。** テストDBを共有しており、各テストの前に全テーブルを `TRUNCATE` するため、2つのjestプロセスが互いのデータを消し合います。CI・ローカルとも1本ずつ実行してください
2. **`docker compose exec backend npm test` は使わない。** 以前はコンテナの `DATABASE_URL`（＝**開発DB**）が使われ、テストのたびに開発データが消えていました。現在は `.env.test` が必ず優先されるよう修正済みで、その結果コンテナ内からはテストDBに到達できず失敗します（安全側の設計）
3. **本番DBに対して絶対に実行しない。** `export DATABASE_URL=<本番>` した状態で `npm test` を叩くと本番が全テーブル消去されうるため、接続先ホストとDB名の二重ガードで中断するようにしてあります（`localhost`/`127.0.0.1`/`db` 以外、または `_test` で終わらないDB名は拒否）
4. **flakyを見つけたら `.skip` で隠さない。** 原因を特定して直します（過去に `supertest` の一時サーバ生成レースで約1/2の確率で落ちる状態を根絶した経緯があります。詳細は `docs/dev-org/TEST-PLAN.md`）
- `npx tsc --noEmit`: エラー0
- `npm run build`: 成功（生成される9ルート = `/`, `/handbook`, `/login`, `/register`, `/sessions`, `/sessions/[id]`, `/sessions/new`, `/p/[slug]`, `/_not-found`）

GitHubにpushすると `.github/workflows/test.yml` が同じ内容（backendジョブ + frontendジョブ）を自動実行します。

## 使い方（最短の成功体験）

1. `/register` でアカウント作成 → `/login`
2. `/sessions/new` で複数艇のGPXファイル（1艇1ファイル）をまとめて選択し、タイトル・チームを入力して取込
3. `/sessions` の一覧からセッションを開く（`/sessions/[id]`）と、全艇の航跡が同じ時間軸で再生される
4. 再生中に気づいた瞬間で注釈を追加 → タイムラインにピンが残る
5. 画面上部の共有ボタンで現在のURL（再生位置・表示艇込み）をコピーし、同じチームの別メンバーに送る

GPS収録そのものの手順（Geo Trackerの設定・出艇前チェックリスト等）は `/handbook` にまとまっています。

---

## Q&A / トラブルシューティング

実装・検証の過程で実際に踏んだ罠を記録しています（一次ソース: `docs/dev-org/TASKS.md` の「発見事項」）。

### 使い方

**Q. GPXを取り込んだのに保存できない/エラーが出る**
A. 以下のいずれかに該当するとその艇のGPXだけ拒否されます（意図的なバリデーション）。1本でも拒否されると保存ボタン全体が無効化されます。
- 時刻が逆転している点が含まれる
- `trkpt` に緯度・経度・時刻のいずれかが欠落している
- XMLとして壊れている（パース不能）
- 有効な `trkpt` が0件、または1点しかない

該当ファイルだけをGeo Tracker等で録り直すか、そのファイルを除いて残りの艇だけで取り込んでください。

**Q. GPSロガー（Geo Tracker）の設定がわからない**
A. `/handbook`（収録ハンドブック）に設定手順・出艇前チェックリスト・取込手順をまとめています。特に「記録間隔を1〜2秒にする」「位置情報の許可を『常に許可』にする」の2点を間違えると、記録が途中で止まったり間隔が粗くなり反省会での議論に耐えません。

**Q. 部外向けの公開URLはありますか**
A. 機能としては実装済みです。`/sessions/[id]` の「公開する」ボタンから昇格すると、認証不要で開ける読み取り専用ページ `/p/[slug]` が発行されます（手順は上記「部外向け共有（公開ビュー）の使い方」参照）。ただし**本番デプロイ自体がまだのため、インターネット上でアクセスできる公開URLは現時点で存在しません**（後述「デプロイについて」参照）。ローカル環境（`docker compose up` 済みの状態）でのみ `http://localhost:3001/p/[slug]` として確認できます。

**Q. 「公開をやめる」を押した後、同じURLは見られますか**
A. 見られません。取り消し後は同じスラッグへのアクセスが404になります（存在しないスラッグと同じレスポンス）。再度公開すると**別の新しいURLが発行**され、取り消し前のURLが復活することはありません（`docs/dev-org/TASKS.md` T-34のE2E検証で確認済み）。

**Q. 公開ビューに部内の反省会メモや部内ナビゲーションが漏れませんか**
A. 漏れません。注釈は昇格時に選んでチェックしたものだけがAPIレスポンス・DOMの両方に出ます（既定は全注釈非公開）。公開ビューはログインリンクや部内タブなどのナビゲーションも表示しない専用レイアウトです（T-33検証で確認済み）。

### セットアップ・開発環境

**Q. `docker compose exec backend npm test` が `Cannot find module 'pg'` で落ちる**
A. `docker-compose.yml` の backend は `./backend:/app` に加えて `/app/node_modules` を匿名ボリュームとして固定しているため、イメージビルド後に `package.json` へ依存を追加しても、コンテナを再ビルドするまで反映されません。次のコマンドで復旧します。

```bash
docker compose exec backend npm install
```

**Q. frontendコンテナで `package.json` や設定ファイルを編集したのに反映されない**
A. `docker-compose.yml` の frontend は `frontend/src` と `frontend/public` だけをbind mountしており、`package.json`/`vitest.config.ts` 等はイメージビルド時点の内容で固定されています。編集を反映するには次のいずれかが必要です。

```bash
docker compose cp frontend/package.json frontend:/app/package.json
docker compose exec frontend npm install
# vitest.config.ts 等も同様に cp が必要
```

または `docker compose up -d --build frontend` でイメージごと作り直してください。

**Q. `NEXT_PUBLIC_API_URL` を変更したのに反映されない**
A. `NEXT_PUBLIC_*` はNext.jsのビルド時に埋め込まれる値です。`next start`（本番モード）で環境変数だけ変えても反映されません。値を変えたら `npm run build` からやり直してください（このリポジトリの開発時は `next dev` を使っているため通常は意識不要です）。

**Q. `docker compose exec backend npm test` を並列実行するとまれに失敗する**
A. テスト用フック（各テスト前にDBをTRUNCATE）が、Jestのデフォルト並列ワーカーと競合し、FK違反等で非決定的に失敗することがあります。`backend/package.json` の `test` スクリプトは既に `jest --runInBand`（直列実行）をデフォルトにしているため、通常のコマンドで踏むことはありません。自分で `npx jest`（オプションなし）を直接叩くと再現するので避けてください。

**Q. `docker compose exec backend npm test` は本当にテスト専用DBを見ている?**
A. **`docker compose exec` 経由では見ていません。** `docker-compose.yml` が開発用DB（`sailvlog_db`）向けの `DATABASE_URL` をコンテナに既に注入しており、dotenvは既存の環境変数を上書きしないため、`.env.test` の設定（本来は `sailvlog_test`）が無視され、開発DBに対してテストが実行されます。GitHub Actions（CI）ではこの問題は起きません（コンテナ経由ではなくホストで直接 `npm test` を実行するため）。挙動としては開発DBが都度TRUNCATEされるだけでテスト自体は通りますが、開発中に作ったデータが消える点は把握しておいてください。

### 壊れたときの確認手順

1. `docker compose ps` で3コンテナ（`db`/`backend`/`frontend`）が `Up` になっているか確認
2. `docker compose logs backend` / `docker compose logs frontend` で直近のエラーを確認
3. frontendが500を返す・真っ白になる場合、`next dev` が動いているコンテナ内で `npm run build`（本番ビルド）を同時に実行すると `.next` の競合でdevサーバーが壊れることがあります。その場合は `docker compose restart frontend` で復旧します
4. backendがDB接続エラーを出す場合、`docker compose ps` で `db` が `healthy` か確認してから `docker compose restart backend`

### デプロイについて

Neon（DB）/ Render（backend）/ Vercel（frontend）への0円デプロイ構成を想定していますが、**現時点で本番デプロイ・公開URLは存在しません**（オーナーのアカウント作成待ち。`docs/dev-org/TASKS.md` T-02参照）。

## ライセンス

部内限定プロジェクトです。OSSとしての公開・外部貢献は現時点で想定していません。
