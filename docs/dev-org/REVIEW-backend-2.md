# REVIEW（第2次・backend深堀り） — sailvlog v3 / ブランチ `v3/replay-mvp` HEAD=`309b035`

<!-- 契約: 作成者 code-reviewer / 入力: backend/src/**・backend/prisma/**・.github/workflows/**・docker-compose.yml・backend/Dockerfile + ARCH.md + TASKS.md + 1次監査 REVIEW.md / 出力先: implementer（修正）, Team Lead（Gate判定） -->
<!-- code-reviewer は読み取り専用。本レビュー中にコード・設定・他ドキュメントは一切変更していない。1次監査 REVIEW.md も保全（未編集） -->

レビュー日: 2026-07-27 / 対象: **backend のみ**（`frontend/` は別担当Codexが並行作業中のため監査対象外。ただし backend の契約が成立しているかの確認のために frontend のコードを **読むだけ** は行った）

前提: 1次監査の Blocker R-01 / Major R-02・R-03(backend側)・R-04 は「対応済み」として扱い、**同じ指摘は繰り返さない**。本レビューは各修正が**本当に穴を塞いだか**をコードで再確認したうえで、残穴と新規領域のみを書く。

## 判定サマリ

**Quality Gate 判定: FAIL**（Blocker B-01 の解消は必須。B-02 は解消または Team Lead による明示的受容＋ADR記載が必要）

| 深刻度 | 件数 |
|---|---|
| Blocker（出荷不可・データ破壊・セキュリティ） | 2 |
| Major（バグ・設計逸脱） | 7 |
| Minor（改善提案・好み） | 6 |

**FAIL理由の要点**: 1次監査の4件はいずれも**修正の方向は正しく、実装も丁寧**（特に R-03 の共有シークレット方式と R-04 の `wrap()`+多重防御は、依存ゼロという制約下で妥当な解）。しかし
①「**テスト実行が本番DBを消し得る**」という監査範囲外だった経路（B-01）と、
②「**登録が誰でもできるので、R-01の `authMiddleware` は1リクエストで迂回できる**」という**修正の前提の崩れ**（B-02）
が残っている。②は「1次監査の指摘の繰り返し」ではなく、**修正が有効になる前提条件を1次監査が検証していなかった**ことによる見逃しであり、責任はレビュー側にもある。

---

## 1. 全ルート一覧と「誰が叩けるか」（重点観点1）

`backend/src/index.ts:39-64` でマウントされているルータのみ列挙（`routes/articles.ts` 等の未マウント7ファイルは到達不能なデッドコード＝ADR-003のexpand&contract残置）。

| メソッド・パス | 認証 | 認可 | 実際に叩けるのは誰か | 備考 |
|---|---|---|---|---|
| `GET /api/health` | なし | なし | 誰でも | 情報漏れなし（`index.ts:35-37`） |
| `POST /api/auth/register` | なし | なし | **インターネット上の誰でも** | **B-02の起点**。招待制でも承認制でもない |
| `POST /api/auth/login` | なし | なし | 誰でも | **M-04**（レート制限なし） |
| `GET /api/users/me` / `PUT /api/users/me` | ✅ | 本人のみ | 本人 | 妥当 |
| `GET /api/users/:username` | ✅ | なし | **任意のログインユーザー** | R-01修正済。ただしB-02で実質誰でも |
| `GET /api/boat-types` | **なし** | なし | 誰でも | 艇種マスタのみ＝実害小。**M-07**（wrap漏れ） |
| `GET /api/sailors` / `GET /api/sailors/:username` | ✅ | なし | **任意のログインユーザー**（全ユーザー横断） | R-01修正済。B-02で実質誰でも |
| `GET /api/teams` | ✅ | なし | **任意のログインユーザー**（全チーム） | 自チーム以外も列挙可 |
| `GET /api/teams/:slug` | ✅ | なし | **任意のログインユーザー**（**他チームの名簿も**） | B-02と合わせてR-01が再成立 |
| `GET /api/teams/:slug/articles` | **なし** | なし | **誰でも** | **M-01**（R-01修正の取りこぼし） |
| `GET /api/teams/:slug/questions` | **なし** | なし | **誰でも** | **M-01** |
| `POST /api/sessions` | ✅ | `requireTeamMemberByBody()` | body.teamId のメンバー | 妥当 |
| `GET /api/sessions?teamId=` | ✅ | インラインでTeamMember検証 | 当該チームのメンバー | 妥当。**M-02**（過剰取得） |
| `GET /api/sessions/:id` | ✅ | `requireSessionTeamMember()` | 当該セッションのチームメンバー | 妥当 |
| `PATCH /api/sessions/:id` | ✅ | `requireSessionTeamMember()` のみ | **チームメンバーなら誰でも**（uploader/admin不要） | **M-06** |
| `DELETE /api/sessions/:id` | ✅ | +`isUploaderOrTeamAdmin()` | uploader本人 or admin | 妥当 |
| `POST /api/sessions/:id/tracks` | ✅ | `requireSessionTeamMember()` | チームメンバー | 妥当（公開中の追加＝1次R-05・判断待ち） |
| `POST /api/sessions/:id/annotations` | ✅ | `requireSessionTeamMember()` | チームメンバー | trackIdの所属も検証済（`sessions.ts:236-242`）✅ |
| `POST /api/sessions/:id/publish` | ✅ | +`isUploaderOrTeamAdmin()` | uploader本人 or admin | 妥当。IDOR対策も可（下記） |
| `POST /api/sessions/:id/unpublish` | ✅ | +`isUploaderOrTeamAdmin()` | uploader本人 or admin | 妥当 |
| `GET /api/tracks/:id/gpx` | ✅(404版) | `isTeamMember()` | チームメンバー | 未認証404・非メンバー403の使い分けは設計どおり |
| `PATCH /api/annotations/:id` | ✅ | `isAuthorOrTeamAdmin()` | author本人 or admin | 妥当 |
| `DELETE /api/annotations/:id` | ✅ | `isAuthorOrTeamAdmin()` | author本人 or admin | 妥当 |
| `GET /api/public/sessions/:slug` | なし（設計どおり） | なし | 誰でも | ADR-007。ホワイトリスト整形済み |
| 凍結13パターン | — | — | 誰でも（410固定） | `app.all` は各ルータの**後**に登録されているが、`/api/users/:username` は1セグメントのみ一致のため `/api/users/x/follow` は正しく410へ落ちる（確認済み） |

**IDOR（他人のIDを渡すと触れるか）の確認結果**: 主要な `:id` 経路はすべて所有者/所属検証を通っている。
- `POST /:id/publish` の `publicAnnotationIds` は `where: { id: { in: ids }, sessionId }` の件数一致で**他セッションの注釈IDを弾いている**（`sessions.ts:288-294`）— 良い実装。
- `POST /:id/annotations` の `trackId` も `track.sessionId !== sessionId` で弾く（`sessions.ts:238`）。
- `PATCH/DELETE /api/annotations/:id` は注釈→session→teamId を辿って検証しており、URLのIDだけでは他チームの注釈に触れない。
- **IDORは検出できなかった**（この観点は "問題なし" と結論してよい）。

---

## 2. 指摘事項

### [Blocker] B-01: `npm test` が**シェルの `DATABASE_URL` を上書きしない**ため、本番DBを全テーブルTRUNCATEし得る（データ破壊）

- 場所: `backend/src/__tests__/setup/env.ts:8`（`dotenv.config({ path: .env.test })`）／`backend/src/__tests__/setup/resetDbHook.ts:7-9`（全テスト前に `resetDb()`）／`backend/src/__tests__/helpers/resetDb.ts:7-13`（`TRUNCATE TABLE ... RESTART IDENTITY CASCADE`）／`backend/scripts/ensure-test-db.js:19-32`（pretestの安全ガード）
- 確度: **CONFIRMED**（コードパスで断定。dotenv の `config()` は既定 `override: false` ＝ **既に `process.env` にある値を書き換えない**。この性質は `env.ts:3-4` のコメント自身が「index.ts 側の `import "dotenv/config"` は上書きしないので先に設定すればよい」と前提にしている＝同じ性質がシェル由来の値に対しても働く）
- 失敗シナリオ（具体的な入力→結果）:
  1. Renderへのデプロイ作業で、ターミナルに本番DBのURLを入れる（例: `export DATABASE_URL="postgresql://…neon.tech/sailvlog?sslmode=require"` して `npx prisma migrate deploy` を流す）。**2026-07-27にRender初回デプロイをした直後の今、実際に起きうる操作**。
  2. 同じシェルで `cd backend && npm test`。
  3. `pretest`（`ensure-test-db.js`）も同じく dotenv で上書きされず、`process.env.DATABASE_URL` = 本番URL のまま進む。ガードは「DB名が空 or `postgres` でないこと」だけなので `sailvlog` は**通過**し、**本番DBに対して `prisma migrate deploy` が走る**。
  4. jest 起動。`beforeEach` ごとに `resetDb()` が `pg_tables` から `_prisma_migrations` 以外の**全テーブル**を `TRUNCATE … CASCADE`。
  5. **本番のユーザー・チーム・セッション・トラック・注釈が全消失**。公開URL（`/p/{slug}`）は全部404。バックアップ運用は本リポジトリに定義がなく、復旧手段が無い。
- なぜ問題か: 「壊れたら自動で気づける」以前に「壊す装置が既定で有効」になっている。しかも `.env.test` を書いた本人からは絶対に見えない事故（`.env.test` は正しい値を持っている）。テスト基盤が本番データを消せる状態は、深刻度としてセキュリティ欠陥と同格に扱うべき。
- 推奨対応（実装判断は implementer）: 二重防御を推奨。①`env.ts` の `dotenv.config` を `override: true` にして、テスト実行時は常に `.env.test` を正とする。②`resetDb()` の冒頭で接続先DB名を検証し、期待するテストDB名（例: 末尾が `_test`）でなければ**例外を投げて即座に止める**（TRUNCATEの直前で見るのが要点。設定ファイル側のガードは①の穴を塞げない）。③`ensure-test-db.js` のガードも「`postgres` でない」ではなく「テストDB名である」に反転させる。

### [Blocker] B-02: 登録が誰でも1リクエストで通るため、R-01 の `authMiddleware` 追加は部員名簿を守っていない

- 場所: `backend/src/routes/auth.ts:16-41`（`POST /api/auth/register` — 招待コード・ドメイン制限・メール確認・管理者承認のいずれも無く、成功時にその場でJWTを返す）／守っているつもりの側: `backend/src/routes/teams.ts:12`, `:44`, `backend/src/routes/sailors.ts:25`, `:55`, `backend/src/routes/users.ts:27`
- 確度: **CONFIRMED**（コードパスで断定。`register` に権限・招待・検証のロジックが1行も無いこと、および対象GETが「TeamMemberであること」ではなく「JWTがあること」しか見ていないことを確認）
- 失敗シナリオ（具体的な入力→結果）:
  1. 部外者が反省会で共有された `https://…/p/{slug}` を開く → 画面とOGPに「○○大学ヨット部」。
  2. `POST /api/auth/register {"username":"x","email":"x@example.com","password":"x"}` → **201 とJWTが即返る**（メール確認なし）。
  3. `GET /api/teams`（Bearer付き）→ **全チームの一覧と slug**。
  4. `GET /api/teams/{slug}`（Bearer付き）→ **部員全員の username / specialty / experienceYears / boatType / avatarUrl / role**。`GET /api/sailors` なら全チーム横断で同じ情報＋`affiliation` と検索機能つき。
  - つまり **R-01 の攻撃経路は「1リクエスト増えただけ」で完全に生きている**。SPEC §5.2 の「`teamId`・メンバー一覧は公開しない」という保証は依然として系全体では成立していない。
- なぜ問題か: 認可の単位が「ログイン済みか」になっているが、本アプリの機密境界は「**そのチームのメンバーか**」であり、`requireTeamMember` という正しい道具が既にある。1次監査の提案（`authMiddleware` を付ける）が浅かったのが直接の原因で、その点はレビュー側の非。ただし**現在のコードが安全でないという事実は変わらない**。
- 推奨対応（案の比較まで。実装判断は implementer/Team Lead）:
  - **案A（推奨・最小）**: `GET /api/teams` を「自分が所属するチームのみ」に絞り（`where: { members: { some: { userId } } }`）、`GET /api/teams/:slug` は**非メンバーには404**を返す。frontend の依存は `sessions/page.tsx:30`・`sessions/new/page.tsx:37`（チーム選択＝自分のチームだけで十分、むしろUX的に正しい）と `lib/teamRole.ts:12-17`（自チームのadmin判定）の3箇所のみで、いずれも**自チームしか必要としていない**ため壊れない（frontendコードを読んで確認済み。修正はCodex担当ではなく不要）。
  - **案B**: `GET /api/sailors`・`GET /api/sailors/:username`・`GET /api/users/:username` は v3 frontend からの利用がゼロ（`grep` 済み。ヒット0）なので、ADR-003 と同じ **410凍結**にする。案Aと併用が最も筋が良い。
  - **案C**: 登録を招待制にする。効果は大きいが7/31までのスコープとしては重い。
  - **受容する場合**: 「部員名簿はログイン済みなら誰にでも見せる／登録は誰でもできる」という決定を **ADRに明記**し、SPEC §5.2 の文言と矛盾しない形に直すこと（この場合はコードでなくドキュメントが正）。暗黙に通過させてよい事項ではない。

### [Major] M-01: `GET /api/teams/:slug/articles` と `/questions` が**未認証のまま**残っている（R-01修正の取りこぼし＋ADR-003凍結との不整合）

- 場所: `backend/src/routes/teams.ts:79`（`router.get("/:slug/articles", …)` — `authMiddleware` なし）／`backend/src/routes/teams.ts:111`（同 `/questions`）。対比: 同ファイル `:12` と `:44` には修正で `authMiddleware` が入っている
- 確度: **CONFIRMED**（コードパス。`index.ts:51-52` の `app.all("/api/articles/*")` 410 は `/api/teams/:slug/articles` には一致しないことも確認。回帰テスト `t95-auth-required-blocker.test.ts` もこの2本を対象にしていない）
- 失敗シナリオ: 部外者が team slug を推測（`waseda-yacht` 等は当てやすい。B-02経由なら推測すら不要）→ `GET /api/teams/{slug}/articles` → **200**。しかも `prisma.article.findMany` は `include` のみで `select` が無いため **`contentMd`（記事本文全文）と `viewCount` を含む全カラム**＋`author.username`／`avatarUrl` が返る。`/questions` も同様に本文と投稿者名を返す。存在しない slug は404なので、**チームslugの存在オラクル**にもなる。
- なぜ問題か: ADR-003 は `/api/articles` `/api/questions` を410で凍結したのに、**同じデータへの別ドアが空いている**。R-01 が「公開ビュー起点で部員名簿へ到達できる」問題だったのに対し、これは「認証すら不要」という点でより素朴な穴。現時点の実害はDBに残っているv1データ量に依存する（seedは記事・ユーザーを作らないため新規DBなら空＝**露出量については疑い**）が、経路が空いていること自体は確定。
- 推奨対応: この2本も410凍結にする（ADR-003と整合。frontendからの利用はゼロ）。凍結しない判断なら最低限 `authMiddleware` ＋ `select` による列指定。併せて `t95` に「未認証401（または410）」のケースを追加。

### [Major] M-02: `GET /api/sessions`（一覧）が `publicViewCount` を返したまま — R-02 の修正が**詳細だけ**に入っている

- 場所: `backend/src/routes/sessions.ts:96-100`（`findMany` に `select` が無く、`include: { _count }` だけ＝**全スカラー返却**）。対比: 詳細側 `sessions.ts:134` には `const { publicViewCount: _publicViewCount, ...session }` の除去が入っている
- 確度: **CONFIRMED**（1次監査 R-02 は `sessions.ts:112` と `:93-97` の**両方**を場所として挙げていた。前者のみ修正され、後者は未修正。`grep publicViewCount backend/src` で、除去処理が詳細側の1箇所しか存在しないことも確認）
- 失敗シナリオ: 部員が `/sessions` 一覧画面を開く → DevTools の Network に `publicViewCount: 12` が並ぶ。ARCH §3 のカラムコメント「APIにも画面にも出さない（PRD §5-7 非KPI）」に反する。`publishedById` も同様に露出。
- なぜ問題か: 非KPI原則は「見えると人が最適化してしまう数字を、そもそも見せない」という製品判断であり、**片方だけ塞いでも約束は守られない**。加えて一覧は `gridJson`/`rawGpx` を持たない Session 行とはいえ `notes` `marks` `legs` まで全部返しており、公開シリアライザで採用した「含めるものだけ列挙」の規律が一覧APIだけ適用外になっている。
- 推奨対応: 一覧も明示 `select` に変える（詳細の分割代入方式より、公開側と同じホワイトリスト方式のほうが将来のカラム追加に強い）。**回帰テストが1本も無い**点が本質的な問題なので、`t12` に「一覧・詳細のどちらのレスポンスにも `publicViewCount` が出現しない」を追加すること（公開APIには `t31:124` の再帰走査があるのに、部内APIには何も無い）。

### [Major] M-03: R-03の修正（共有シークレット方式）は**frontend側が未実装のため、本番では発動しない**

- 場所: backend側は完成: `backend/src/routes/public.ts:40-61`（`proxySecretMatches` / `clientIp`）。契約の相手側: `frontend/src/lib/publicSession.ts:36` — 送っているヘッダは `x-forwarded-client-ip` **のみ**で、`x-internal-proxy-secret` を送っていない（読み取りのみで確認）
- 確度: **CONFIRMED**（現HEADのコード状態として断定。ただし Codex が並行作業中のため、**この瞬間の未実装であって恒久的な欠陥とは限らない**）
- 失敗シナリオ: 本番で `INTERNAL_PROXY_SECRET` を両側に設定しても、Nextがシークレットヘッダを送らない限り `proxySecretMatches()` は false → `clientIp()` は `req.ip`（＝Nextサーバ1台のIP）にフォールバック → **R-03で指摘した「全閲覧者が1バケットを共有」状態に静かに戻る**。反省会当日にLINEで共有して61人目が開いた瞬間、全員に429→404が出る。しかも**何のログも警告も出ない**ので、原因に到達する手がかりがゼロ。
- なぜ問題か: 「動く仕組みを作った」と「本番で有効になっている」の差。この差を検知する手段が現状ゼロで、テスト（`t31` ④-b〜④-e）は backend 単体の分岐を丁寧に検証しているが、**フロントが正しいヘッダを送るかは誰も検証していない**（クロス境界の契約テストが無い）。
- 推奨対応: ①Codexへ申し送り済みの仕様（`public.ts:29-39` のコメント）を実装完了させ、**完了の確認はTeam Leadが両側のコードで行う**。②backend側の保険として、`INTERNAL_PROXY_SECRET` が設定されているのに一度も一致しない状態を起動後N分でログ警告する、または「フォールバックした」ことを `console.warn` に落とす（沈黙して劣化するのが最大の問題なので、**気づける仕組み**を足すのが本筋）。③1次監査の案C（`shouldCountView` をIP依存でなくする／LIMITを上げる）を併用すれば、ヘッダ経路が死んでも当日の可用性は守れる。

### [Major] M-04: `POST /api/auth/login` にレート制限が無く、bcrypt cost 12 と組み合わさって単一インスタンスを飽和させられる

- 場所: `backend/src/routes/auth.ts:44-70`（login。`checkRateLimit` は `public.ts` からしか呼ばれていない）／`backend/src/routes/auth.ts:32`（`bcrypt.hash(password, 12)`）／`backend/src/lib/rateLimiter.ts` は公開ルート専用
- 確度: **CONFIRMED**（レート制限の適用箇所を全文検索し、`public.ts:69` の1箇所のみであることを確認）
- 失敗シナリオ（2つ）:
  1. **可用性**: 攻撃者（あるいは壊れたスクリプト）が `/api/auth/login` を並列に投げる。bcrypt の比較は cost 12 で1回あたり数百ms、しかも **Node のメインスレッドではなくスレッドプール（既定4）を専有**する。数十リクエストで、部員の正当なログインも公開ビューの取得も待たされる。RenderのS構成・単一インスタンスなので逃げ場がない。
  2. **総当たり**: 部員のメールアドレスは推測しやすく（大学メール）、パスワードポリシーも無い（M-11参照）ため、無制限に試行できる。JWTを1つ取られれば全セッションのGPX原本まで到達できる。
- なぜ問題か: ADR-007 で脅威モデルを「インターネット全体」に変えたのに、**レート制限は公開GETにしか付いていない**。書き込み・認証系のほうが本来コストが高い。
- 推奨対応: 既存の `checkRateLimit` を `/api/auth/login` と `/api/auth/register` にも適用する（別バケット・別上限で。例: IP単位で1分10回）。新規依存は不要。併せて `rateLimiter.ts:1-3` のコメント「T-31: 公開API用」を、汎用ユーティリティである旨に更新すること。

### [Major] M-05: `JWT_SECRET` に既知のプレースホルダ値が2箇所にあり、未設定・既定値のまま起動できてしまう

- 場所: `docker-compose.yml:26`（`JWT_SECRET: change_this_secret_in_production`）／`backend/.env.example:15`（**同一の文字列**）／使用側 `backend/src/middleware/auth.ts:19`, `:42`, `backend/src/routes/auth.ts:38`, `:64`（いずれも `process.env.JWT_SECRET as string` で、**存在確認も既定値チェックも無い**）
- 確度: 起動時ガードが存在しないことは **CONFIRMED**。本番Renderに実際にこの値が入っているかは**疑い**（環境変数は本リポジトリからは確認できない。**確認方法**: Renderのダッシュボードで `JWT_SECRET` が `change_this_secret_in_production` でないこと、`INTERNAL_PROXY_SECRET`・`CORS_ORIGIN` が本番値であることを目視確認する）
- 失敗シナリオ: ①`JWT_SECRET` を設定し忘れて本番起動 → `jwt.sign` が例外 → グローバルハンドラで500 → **register/login が全滅**するが、原因は「Internal Server Error」からは分からない（`auth.ts:12` の `JWT_EXPIRES_IN` も同様に実行時まで検証されない）。②公開リポジトリのプレースホルダ値のまま起動 → **誰でも任意の `userId` のJWTを偽造でき、全チームの全データ（GPX原本含む）が読み書きできる**。②は起きたら終わりの類の事故で、防ぐコストは数行。
- 推奨対応: 起動時（`index.ts` の先頭）に必須環境変数を検証して**fail-fast**する。最低限 `JWT_SECRET` が未設定 or プレースホルダ値と一致 or 32文字未満なら起動を中止。`CORS_ORIGIN` 未設定時に localhost にフォールバックする現状（`index.ts:25`）も本番では静かな事故になるので同時に検討対象。

### [Major] M-06: `PATCH /api/sessions/:id` の `notes`/`marks`/`legs` が**完全に無検証**で、`legs` はそのまま公開ペイロードへ出る

- 場所: `backend/src/routes/sessions.ts:156-158`（`if (notes !== undefined) data.notes = notes;` 等、型・サイズ・構造のチェックなし）／露出先: `backend/src/lib/serializePublicSession.ts:51`（`legs: session.legs`）／サイズ上限: `index.ts:31`（`/api/sessions` は 8MB）／権限: `requireSessionTeamMember()` のみ＝**uploaderでもadminでもないチームメンバーが実行できる**
- 確度: **CONFIRMED**（コードパス。`title` だけが検証され、他3つは素通しであることを確認）
- 失敗シナリオ: 部員が（あるいはフロントのバグが）`PATCH /api/sessions/12 {"legs": "L1"}` を送る → 200で保存 → 公開ビューが `legs` を配列前提で扱っていれば `legs.map is not a function` で**公開ページが壊れる**（部外者に見えている状態で）。悪意なしでも `{"notes": {...8MBのJSON}}` で Session 行を肥大化させられる。`marks`/`legs` は Json 列なので Prisma もDBも型で守ってくれない。
- なぜ問題か: ARCH §4 の「サーバ側再検証（フロントパースを信頼しない）」は Track/Annotation には `validateTrackPayload`/`validateAnnotationPayload` として実装されているのに、**同じセッションの Json 列だけ例外**になっている。しかも `legs` は共有1で**公開面に出るデータに昇格した**（ADR-007以前は部内限定だった）ので、扱いの格が上がっているのに検証が追いついていない。
- 推奨対応: `validateSessionPatchPayload`（仮）を追加し、`legs` は `[{label: string, startSec: 0以上の整数}]` の配列・要素数上限あり、`marks` は `[{label, lat∈[-90,90], lon∈[-180,180]}]`、`notes` は文字列＋長さ上限、で検証する（既存2つのバリデータと同じ形にそろえるのが自然）。権限を uploader/admin に上げるかは仕様判断（Team Lead）。**プロトタイプ汚染は成立しない**ことは確認済み（`data` は固定キーのみに代入しており、`Object.assign(req.body)` のような合流が無い）。

### [Major] M-07: `GET /api/boat-types` が未認証かつ `wrap()` 漏れ — DB例外でレスポンスが返らずクライアントがハングする

- 場所: `backend/src/routes/boatTypes.ts:7-13`（`router.get("/", async (…) => {…})` — `authMiddleware` も `wrap()` も無い。ファイル内に `asyncHandler` の import 自体が無い）
- 確度: **CONFIRMED**（R-04 修正で `wrap()` が入ったファイルを全数確認した結果、`boatTypes.ts` **だけ**が漏れている。`teams.ts` は `wrap()` ではなく従来の try/catch で守られているので実害なし）
- 失敗シナリオ: Neonのスケールダウン明けや接続断で `prisma.boatType.findMany` が reject → Express 4 は捕まえない → `index.ts:80` の `process.on("unhandledRejection")` がログを出して**プロセスは生き残る**（R-04の多重防御は効いている）が、**このリクエストにはレスポンスが返らない**。呼び出し側はブラウザ/プロキシのタイムアウト（数十秒）まで待たされ、エラー表示もされない。未認証で誰でも叩けるので、遅延を溜める嫌がらせにも使える。
- なぜ問題か: R-04 の修正方針は「`wrap()` を全 async ハンドラに付ける」であり、1本の漏れは方針の穴ではなく**適用漏れ**。`index.ts:67-68` のコメントが「各ルートは wrap() で包んでおり」と断言しているため、コメントと実態がずれている点も後続の読み手を誤らせる。
- 推奨対応: `boatTypes.ts` に `wrap()` を適用。加えて、v3 frontend からの利用がゼロ（`grep` 済み・ヒット0）なので **410凍結の候補**でもある（ADR-003整合）。どちらを採るかは Team Lead 判断。

---

### [Minor] m-01: `teams.ts` だけが独自の `PrismaClient` を生成しており、接続プールが二重になる

- 場所: `backend/src/routes/teams.ts:6`（`const prisma = new PrismaClient()`）。他の全ルートは `backend/src/database.ts` のシングルトンを import
- 確度: CONFIRMED（`grep "new PrismaClient"` → `database.ts` / `seed.ts` / `teams.ts` の3箇所。実行時に生きるのは前2つ＋teams）
- 影響: Prisma の既定プール（`num_cpus*2+1`）が2セット張られる。Neonの無料枠は同時接続数が絞られており、**枯渇時に「たまに `Timed out fetching a new connection` で500」**という再現しづらい障害になる。テストでも `resetDb()` が使う接続とteams用接続が別なので、稀にTRUNCATEとの競合が起きうる。
- 提案: `database.ts` の import に統一。

### [Minor] m-02: レート制限・閲覧間引きの `Map` に破棄処理が無い（1次R-03の提案②が未対応）

- 場所: `backend/src/lib/rateLimiter.ts:13`（`buckets`）／`:33`（`lastViewedAt`）
- 確度: CONFIRMED（削除・期限切れ掃除のコードが無いことを確認）
- 影響: プロセスが生きている限りキー（IP、IP:slug）が増え続ける。Renderの常時起動インスタンスで数ヶ月動かすと純増。閲覧数が数十のうちは無害だが、**M-04の対策としてauth系にも同じ仕組みを流用すると増加ペースが跳ね上がる**ので、流用の前に直すのが順序として正しい。
- 提案: ウィンドウ経過エントリの遅延掃除（アクセス時に確率的に掃除する等）か、エントリ数の上限＋LRU。数行で済む。

### [Minor] m-03: `Track.sessionId` にインデックスが無く、セッション詳細・公開ビューの度にシーケンシャルスキャンになる

- 場所: `backend/prisma/schema.prisma:366-382`（`Track` に `@@index` 無し。PostgreSQLではPrismaはFKに自動でインデックスを張らない — マイグレーションSQL全文を確認し `Track` に `CREATE INDEX` が無いことを確認済み）。対比: `Annotation` には `@@index([sessionId, tSec])` がある（`schema.prisma:399`）
- 確度: CONFIRMED（マイグレーションの `CREATE INDEX` 一覧で断定）
- 影響: 現在のデータ量（数十行）では体感ゼロ。1シーズン分（数百セッション×数艇）でも問題ない規模なので、**今すぐ直す必要は無い**。ただしトラックは `rawGpx`（最大5MB）を同じテーブルに持つため、行サイズが大きくスキャンコストは行数以上に効く。
- 提案: 次にマイグレーションを作るついでに `@@index([sessionId])` を足す。単独でマイグレーションを切るほどではない。あわせて `GET /api/sessions/:id` が `requireSessionTeamMember()` で取得済みのセッションを `sessions.ts:114` でもう一度 `findUnique` している（`POST /:id/tracks` の `:192`、`/:id/annotations` の `:222` も同様）点も、同じタイミングで整理するとクエリが3本減る。

### [Minor] m-04: `publicAnnotationIds` の要素数に上限が無い

- 場所: `backend/src/lib/validatePublishPayload.ts:27-36`（配列であること・要素が整数であることは見るが、**長さを見ていない**）／使用側 `sessions.ts:288-290`（`where: { id: { in: ids } }`）
- 確度: CONFIRMED
- 影響: 8MBのボディに数十万個の整数を詰めると、巨大な `IN (…)` が発行される（Postgresのパラメータ上限に当たれば例外→500）。認証済みチームメンバーしか叩けないので優先度は低い。
- 提案: 上限（例: 500）を足す。1行。

### [Minor] m-05: `POST /api/auth/register` の入力検証が「存在すること」だけ

- 場所: `backend/src/routes/auth.ts:19-22`（`!username || !email || !password` のみ。長さ・形式・型を見ていない）／スキーマ側 `schema.prisma:12-13`（`username` VarChar(50)・`email` VarChar(255)）
- 確度: CONFIRMED
- 影響: ①51文字以上の username → Prisma の P2000 → グローバルハンドラで **500**（本来400であるべきで、利用者は原因が分からない） ②`email` の形式検証が無いので `"a"` でも登録できる ③パスワード長の下限が無い（M-04の総当たりと合わせると効く） ④`username` に数値やオブジェクトを渡すと Prisma 例外→500。
- 提案: 長さ・形式・型の検証を足して400で返す。既存の `validate*Payload` と同じ形にそろえるのが読み手に優しい。なお **409のメッセージが「ユーザー名またはメールアドレス」と両者をまとめており、どちらが既存かを教えていない**のは良い設計（ユーザー列挙の粒度を落としている）— ここは変えないこと。

### [Minor] m-06: 本番ビルド・本番設定の小物（`npm ci` でない／prisma CLI 不在／root実行／`X-Powered-By`）

- 場所: `backend/Dockerfile:8`（`npm install` — `package-lock.json` を無視するため**ビルドの再現性が無い**。CIは `npm ci` を使っており不一致）／`Dockerfile:27`（production も `npm install --omit=dev`）／`Dockerfile:22-35`（production ステージに `prisma` CLI が無いため**このイメージ内で `prisma migrate deploy` を実行できない**）／`index.ts:22`（`app.disable("x-powered-by")` が無い）
- 確度: `npm install` と CLI 不在は CONFIRMED。**マイグレーション運用が実際に困っているかは疑い**（Renderのビルド/デプロイコマンド側で流している可能性がある。**確認方法**: Renderのサービス設定で Pre-Deploy / Build Command に `prisma migrate deploy` があるか確認する）
- 影響: ①依存が勝手に上がってCIで通ったものと違うものが本番に出る（今回まさに `@types/jsonwebtoken` のマイナー更新で型エラーが本番ビルドまで露見した前例がある — `.github/workflows/test.yml:40` のコメント参照） ②マイグレーション適用手段が暗黙 ③`X-Powered-By: Express` は未認証で誰でも取れる指紋情報（実害は小さいが1行で消せる）。なお**root実行**（`USER` 指定なし）はコンテナ内のみの話で、S規模では許容範囲。
- 提案: `npm ci` に変更（Dockerfileの2箇所）。マイグレーション手順を `docs/` かREADMEに明記。`app.disable("x-powered-by")` は好みの範囲だが安い。

---

## 3. 確認したが**問題が無かった**領域（何を見て、何を見ていないか）

深く見て「問題なし」と結論した項目。ここに書いていないものは見ていないと解釈してよい。

**認可・認証**
- **IDOR**: 上記§1の表のとおり全 `:id` 経路を追跡。`publicAnnotationIds` の所属検証（件数一致）、`trackId` の `sessionId` 一致、注釈→session→team の権限追跡はいずれも正しい。**IDORは1件も検出できなかった**。
- `authMiddlewareOr404`（`middleware/auth.ts:30-48`）は `authMiddleware` とロジックが同一で、失敗時のステータスのみ404。「未認証に『存在するが権限が要る』を教えない」という意図どおりで、`GET /api/tracks/:id/gpx` にのみ適用されている（適用範囲の取り違えなし）。
- 認証失敗時のメッセージは「トークンがありません」と「無効または期限切れ」の2種類だが、いずれも**リソースの存在有無を漏らさない**。ログイン失敗も `!user` と `パスワード不一致` で**同一の401メッセージ**に統一されている（`auth.ts:54`, `:60`）— ユーザー列挙対策として正しい。
- JWTは `jsonwebtoken@^9.0.2`。v9 は `alg: none` を既定で拒否するため、`algorithms` 未指定でも `alg` 差し替え攻撃は成立しない（HS/RS混在の設定も無い）。**問題なし**。
- 公開ルートの404オラクル: 1次監査の結論（ボディ・ステータス完全一致、72ビットのスラッグ空間でタイミング差は無意味）を再確認し、**変化なし**。`unpublish` が `publicSlug` を null にするので取り消し済みは物理的にヒットしない。

**未認証で到達できる経路の再点検**
- `/api/health` は `{status, timestamp}` のみ。DBに触らないのでDB停止中でも200＝ヘルスチェックとしては甘いが、**情報漏洩は無い**。
- 410ハンドラは各ルータの後段に登録されているが、Expressのパス一致規則上、生きているルータのパスを食う組み合わせは無い（`/api/users/:username` は1セグメント一致のため `/api/users/x/follow` は410へ落ちる）。**問題なし**。
- 未認証で到達できるのは `health` / `auth/*` / `boat-types` / `public/sessions/:slug` / `teams/:slug/{articles,questions}`（M-01）/ 410群 の6系統。**列挙は完了している**。
- レスポンスヘッダの差分は無い（公開ルートは追加ヘッダを設定していない）。`X-Powered-By` は全ルート共通で出るため経路の区別には使えない。

**入力検証**
- `validateTrackPayload`（`lib/validateTrackPayload.ts`）を境界まで追った: `Number.isInteger` を使っているため **NaN・Infinity・`1e999`・小数・文字列は全て弾かれる**（`Number.isInteger(NaN)===false`）。負数は明示チェックあり。`lat.length !== lon.length !== pointCount` の三者一致、`gaps` の `0 ≦ start ≦ end < pointCount`、2MB/5MBのサイズ上限（**超過秒数より先に判定**して413を一意に返す順序も意図的で正しい）。巨大配列は `pointCount` 一致＋2MB上限で抑えられている。**穴は見つからなかった**。
- `validateAnnotationPayload`: `tSec ∈ [0, durationSec]`・`body ≦ 2000字`・`trackId`/`legIndex` の整数性。`body.trim().length === 0` で空白のみも弾く。**問題なし**。
- `validatePublishPayload`: R-08（trim不一致）は `learningSummary.trim().length` に統一され**修正済み**、`t30:98` に境界テスト（400字＋末尾空白＝200）もある。良い。残る穴は m-04（配列長）のみ。
- **プロトタイプ汚染**: `__proto__`/`constructor` を含むJSONを投げても、`data` オブジェクトへの代入はすべて固定キー（`data.title = …` 等）で、`Object.assign`/スプレッドによるユーザー入力の合流が無い。Json列に文字列として保存されるだけで実行時の汚染は起きない。**成立しない**。
- SQLインジェクション: 全クエリがPrismaのパラメータ化。唯一の生SQLは `resetDb.ts:13` の `$executeRawUnsafe` だが、値は `pg_tables` 由来でユーザー入力ではない（**ただしB-01の対象**）。**インジェクションは無し**。

**Prisma / SQL**
- N+1は検出できなかった。`Promise.all` での並列取得、`_count` の集約、`include` のネストは1クエリに畳まれる形で書かれている。
- `select` 漏れによる過剰取得は M-01（articles）と M-02（sessions一覧）の2箇所のみ。公開APIは `public.ts:82-95`・`:106-127` で**列を明示列挙**しており、`rawGpx` を SELECT 自体に含めない徹底ぶりは良い。
- トランザクション: `publish` は `$transaction` で「セッション更新＋全注釈をfalse＋選択分をtrue」を原子的に実行しており、**途中失敗で「公開されたのに注釈選択が前回のまま」になる不整合は起きない**。設計として正しい。`unpublish` は単一 `update` なのでトランザクション不要。
- スラッグ衝突の事前チェックと `update` の間のレースは残るが、72ビット空間・単一インスタンス・想定数十本では発生しない（発生時も `@unique` 違反→グローバルハンドラで500＝データは壊れない）。**受容してよい**。

**エラー処理**
- グローバルエラーハンドラ（`index.ts:71-75`）は `{error: "Internal Server Error"}` の固定文字列のみ返し、**スタック・SQL・Prismaのメッセージをレスポンスに出していない**。`console.error` にだけ詳細を残す形で正しい。`teams.ts` の各 catch も同様。**内部情報の染み出しは無い**。
- `res.headersSent` のチェックがあり、二重送信でクラッシュしない。
- `process.on("unhandledRejection"/"uncaughtException")` の多重防御は、`wrap()` 漏れ（M-07）が起きても**プロセスは死なない**ことを実際に担保している。`t96` が「例外後も次のリクエストが処理される」を検証しているのは良いテスト。
- 公開ビューの閲覧数加算が `.catch(() => undefined)`（`public.ts:135`）で握りつぶされているのは、**閲覧を止めないための意図的な割り切り**で妥当。

**秘密・設定**
- ソースに秘密のハードコードは無い（`grep` 済み）。`.gitignore` の `.env` はサブディレクトリにも効くため `backend/.env` は追跡されていない（`git ls-files` で確認: 追跡されているのは `.env.example` と `.env.test` のみ）。
- `.env.test` の値はローカル専用のダミーで、ファイル内にその旨の説明もある。**問題なし**。
- `backend/.dockerignore` は `.env` と `.env.*` を除外しており、**イメージに秘密が焼き込まれない**。良い。
- `docker-compose.yml` のダミー値が本番に混ざる余地: composeファイル自体は本番デプロイに使われない（RenderはDockerfile/ビルドコマンド）ので**直接の混入経路は無い**。ただし `.env.example` に同じプレースホルダが載っている点は M-05 の懸念として残る。
- `.env.example` と実コードの乖離: `JWT_EXPIRES_IN=2h`（コード側の既定は `30m`＝より安全側）、`INTERNAL_PROXY_SECRET`（空＝安全側フォールバックの説明つき）、`CORS_ORIGIN`。**コードが参照する環境変数はすべて `.env.example` に記載されている**（`grep process.env` で突き合わせ済み）。乖離なし。

**CI**
- `.github/workflows/test.yml:41-43` に `tsc --noEmit` → `npm run build` → `npm test` の順で入っており、1次監査のテスト評価⑤（型エラーがCIをすり抜ける）は**解消済み**。順序を「型→ビルド→テスト」にした理由と、実際に起きた事故（`auth.ts` の型エラーがRenderデプロイで初めて露見）をコメントに残しているのは良い。

---

## 4. テストの穴（「半年後に黙って壊れたら困る」のに検知手段が無い経路）

1. **部内APIの `publicViewCount` 非露出**（M-02）— 公開APIには `t31:124` の再帰走査があるのに、部内APIには1本も無い。詳細側の修正すら回帰テストが無いので、次に `select` を触った人が黙って戻せる。
2. **未認証で叩けるルートの全数チェック**（M-01・B-02）— `t95` は5本のエンドポイントを個別に列挙して検証しているが、**新しくルートが増えたときに漏れる**構造。「マウント済みルータの全ルートを走査し、許可リスト（health/auth/public/410群）以外は未認証で200を返さない」という**網羅型のテスト**にすれば、今回のM-01は自動で捕まっていた。1次監査で `t31` の禁止キー再帰走査を高く評価したのと同じ発想（実装の細部でなく外から見た約束を検証する）を、認可にも適用してほしい。
3. **フロント⇄バックのヘッダ契約**（M-03）— backend単体のテストは充実しているが、Nextが正しいヘッダを送るかは誰も見ていない。壊れても**静かに劣化する**（429が出るまで気づかない）のが最悪の性質。
4. **`PATCH /api/sessions/:id` の異常系**（M-06）— `t12:303` は正常系1本のみ。`legs` に不正な型を入れた場合の期待値がテストに書かれていないため、「今の素通しは仕様なのかバグなのか」がコードからも記録からも判断できない。
5. **テストDBのガード**（B-01）— ガード自体が無いので当然テストも無い。`resetDb()` が想定外の接続先で例外を投げることを検証する1本が、そのままガードの実装を強制する。

---

## 5. 良かった点（学習資産として言語化）

1. **`public.ts:40-55` の `proxySecretMatches` が、実装の細部まで「なぜ」を守っている。** 長さが違うと `timingSafeEqual` が例外を投げるという実装上の罠を、`return false` で早期脱出せず**同じ長さのダミー比較を挟んでから返す**ことで、定数時間比較の意図を壊さずに回避している。ここは「動けばいい」で書くと必ず早期returnになる箇所で、**目的（タイミング差を作らない）を理解して書いた**ことが読み取れる。しかも `INTERNAL_PROXY_SECRET` 未設定時は「常に不一致＝ヘッダを信用しない」という**安全側のデフォルト**を選んでいる（機能が効かないより、詐称される方が悪いという優先順位が正しい）。
2. **`asyncHandler.ts` の `wrap()` が、制約（新規npm依存禁止）を守りつつ最小の面積で解いている。** `express-async-errors` を入れれば1行で済むところを、6行の関数と「既存のハンドラをそのまま包める」という移行しやすさで解決し、さらに `process.on(unhandledRejection)` を**保険として併置**して「wrap漏れがあってもプロセスは死なない」多重防御にしている。今回まさに M-07（`boatTypes.ts` の漏れ）が実在したので、**この保険は既に一度仕事をしている**。単一の対策に賭けず層を重ねる判断は、そのまま他プロジェクトへ持っていける。
3. **`t31` の④-b〜④-e が、セキュリティ機構の「効いている状態」と「効かない状態」を両方テストしている。** 「正しいシークレットなら別バケット」だけでなく「シークレット無しなら無視」「不一致なら無視」「環境変数未設定なら無視」の3つの**否定側**を書いている。セキュリティのテストは肯定側だけ書くと「バイパスできないこと」を全く検証できないので、この4本セットは教科書的。
4. **`ensure-test-db.js:29-32` に「危険な設定を検出」のガードを書こうとした発想自体は正しい。** B-01 はこのガードが**チェックしている変数を間違えている**（`.env.test` の値ではなく実効値を見るべきだった）ことによる失敗であって、危険性への感度は持っていた。方向は合っているので、直すのは数行で済む。

---

## 6. implementer への優先順位（推奨）

1. **B-01**（データ破壊。修正は数行。他の作業より先に入れるべき — 直している最中にも事故は起こり得る）
2. **B-02**（Gate解除の条件。案A＋案Bで frontend は壊れないことを確認済み）
3. **M-01 / M-07**（どちらも「1行足す or 410にする」で終わる。B-02と同じファイル群なので同時に）
4. **M-03**（デモ当日の可用性に直結。Codexの実装完了確認＋backend側の警告ログ）
5. **M-02 / M-04 / M-05**（小さい修正で効果が大きい。M-02は回帰テストとセットで）
6. **M-06**（検証を足すか、「Json列は無検証で受ける」を仕様として書くかの判断だけでも先に）
7. Minor群（m-01 と m-02 は他の修正のついでに。m-03 は次のマイグレーション時、m-06 はデプロイ手順の確認とセットで）
