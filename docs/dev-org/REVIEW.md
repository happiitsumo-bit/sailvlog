# REVIEW — sailvlog v3 / `b95fde3..HEAD`（ブランチ `v3/replay-mvp`・共有1スライス）

<!-- 契約: 作成者 code-reviewer / 入力: 実装済みコード + ARCH.md(ADR-007) + SPEC-share1-phase1.md + PRD.md + UI-DESIGN.md + TASKS.md / 出力先: implementer（修正）, Team Lead（Gate判定） -->
<!-- code-reviewer は読み取り専用。本レビュー中にコード・設定・他ドキュメントは一切変更していない -->

レビュー日: 2026-07-26 / 対象コミット: `b9f363f`〜`cbb4d17`（17コミット・98ファイル・+6691/-6188）

## 判定サマリ

**Quality Gate 判定: FAIL**（Blocker R-01 の解消、または Team Lead による明示的受容＋ADR記載まで、公開URLを部外へ配布しない）

| 深刻度 | 件数 |
|---|---|
| Blocker（出荷不可・データ破壊・セキュリティ） | 1 |
| Major（バグ・設計逸脱） | 5 |
| Minor（改善提案・好み） | 8 |

**FAIL理由の補足（重要）**: 共有1本体（T-30〜T-34）の実装品質は高く、ホワイトリスト整形・一律404・注釈の既定非公開はいずれも設計どおり機能している（§確認済み領域）。FAILの唯一の原因は R-01 = **v1由来の未認証APIが残っており、公開ビューを起点に部員名簿が誰でも取れる**こと。修正は「ルートに `authMiddleware` を足す or ADR-003と同じ410化」で済む小さいものだが、SPEC §5.2 が明文で約束した保証（`teamId`・メンバー一覧は公開しない）が**系全体では成立していない**ため、Blockerとして扱う。「部員名簿は元々v1で公開前提だった」という判断で受容するなら、それはADR更新で明示すべき決定であって、暗黙に通過させてよい事項ではない。

---

## 指摘事項

### [Blocker] R-01: 公開ビューの `team.name` を起点に、未認証で部員名簿を列挙できる（ADR-007/SPEC §5.2 の保証が系全体で崩れている）

- 場所:
  - `backend/src/routes/teams.ts:8`（`GET /api/teams` — 認証なし）
  - `backend/src/routes/teams.ts:40-64`（`GET /api/teams/:slug` — 認証なし・`members` 全件を `user.username/specialty/experienceYears/boatType` 込みで返す）
  - `backend/src/routes/sailors.ts:20`, `backend/src/routes/users.ts:22`（同じく認証なしのユーザー列挙・プロフィール）
  - 露出の起点: `backend/src/lib/serializePublicSession.ts:57`（`team: { name: session.team.name }`）／`frontend/src/app/p/[slug]/PublicReplayView.tsx:135`（チーム名を画面表示）／`frontend/src/app/p/[slug]/page.tsx:33`（OGPタイトルにもチーム名）
- 確度: **CONFIRMED**（コードパスを追って断定。`teams.ts:8/40` に `authMiddleware` が付いていないことを確認済み。動的な攻撃実行はしていない＝読み取り監査の範囲）
- 失敗シナリオ: 部外者が `https://…/p/{slug}` を開く → 画面/OGPに「○○大学ヨット部」が出る → `GET /api/teams` でチーム一覧と `slug` を取得（認証不要） → `GET /api/teams/{slug}` で**部員全員の username・専門・経験年数・艇種**を取得。emailは含まれないが、SPEC §5.2 が「`teamId`/チームメンバー一覧は**除外**。チーム表示名のみ可」と書いた保証は破れている。`GET /api/sailors` は全ユーザーを検索可能な形で返すため、名簿はチーム単位を超えて取得できる。
- なぜ問題か: ADR-007の趣旨は「脅威モデルが部内認証済みユーザーからインターネット全体へ変わる」ことへの対応。公開ペイロード側は正しくホワイトリスト化されたが、**同じアプリの別ドアが開いたまま**なので、脅威モデルの変更が系全体に適用されていない。しかも T-26 でフロントの `/teams` `/sailors` `/users` 画面は削除済みであり、これらのGETは `frontend/src/lib/teamRole.ts:12-19` の `fetchIsTeamAdmin`（JWTを載せて呼ぶ）以外に利用者がいない＝**認証必須化してもフロントは壊れない**。
- 提案: ①`teams`/`sailors`/`users` の列挙・詳細GETに `authMiddleware` を付ける（`fetchIsTeamAdmin` はJWT付きで呼んでいるため影響なし）か、ADR-003と同じ410凍結にする。②`teamRole.ts` が「未認証でも叩ける既存API」に依存している旨のコメント（`teamRole.ts:2-4`）は、認証必須化後に更新が必要。③受容する場合は「部員名簿はv1から公開情報として扱う」旨をADRに書き、SPEC §5.2の表現と矛盾しない形に直す（この場合はコードでなくドキュメントが正）。

---

### [Major] R-02: `publicViewCount` が部内API `GET /api/sessions/:id` / `GET /api/sessions` のレスポンスに出ている（ARCH §3・SPEC §4-3・PRD §5-7 違反）

- 場所: `backend/src/routes/sessions.ts:112`（`prisma.session.findUnique({ where: { id } })` — selectなしで全カラム返却）／`backend/src/routes/sessions.ts:93-97`（一覧も `findMany` + `_count` のみでselect無し）
- 確度: **CONFIRMED**（`select` が無いためPrismaは全スカラーを返す。`publicViewCount` と `publishedById` が含まれる）
- 失敗シナリオ: 部員が `/sessions/[id]` を開く → DevToolsのNetworkタブに `publicViewCount: 12` が出る。ARCH.md §3の当該カラムのコメントは「**APIにも画面にも出さない**（PRD §5-7 非KPI。参照は運用SQLのみ）」、SPEC §4 設計上の約束3も同文。公開APIだけがテスト（`t31-public-api.test.ts:124` の禁止キー再帰走査）で守られており、**部内APIは無防備**。
- なぜ問題か: 非KPI原則は「見えると人が最適化してしまう数字を、そもそも見せない」という製品判断であり、認証の有無とは別軸の約束。いま実害が小さいのは事実だが、UIに出すのは `detail.session.publicViewCount` と書くだけの距離になっている。
- 提案: セッション詳細/一覧の取得を明示的な `select` に変える（公開シリアライザと同じ「含めるものだけ列挙」を部内APIにも適用）。併せて `t30`/既存セッションAPIテストに「`publicViewCount` が部内レスポンスに含まれない」1ケースを追加（qa-engineer範囲）。

---

### [Major] R-03: レート制限と閲覧数の間引きが `req.ip` キーだが、公開ビューの全トラフィックがNext.jsサーバ1台のIPで到着する（自己DoS＋計測破壊）

- 場所: `backend/src/lib/rateLimiter.ts:14-24`（`checkRateLimit(ip)`）・`:38-46`（`shouldCountView(ip, slug)`）／`backend/src/routes/public.ts:16-18`（`req.ip ?? socket.remoteAddress`）／`backend/src/index.ts`（**`app.set("trust proxy", …)` が存在しないことを確認**）／`frontend/src/lib/publicSession.ts:16-21`（公開ページのfetchは**サーバーコンポーネントから**＝クライアント直叩きは無い）
- 確度: **CONFIRMED**（構成の帰結。①`/p/[slug]` は `page.tsx` と `generateMetadata` の双方がサーバー側 `fetch` を使い、ブラウザからbackendへ直接叩く経路が存在しない ②Express は `trust proxy` 未設定なので `req.ip` はソケット相手＝Next/Vercel および Render プロキシのIP）
- 失敗シナリオ（2つ）:
  1. **可用性**: 全世界の閲覧者が1つのバケットを共有するため、1分間に61回 `/p/*` が開かれた時点で backend が429を返し、`fetchPublicSession` が `null` → `notFound()` となり、**生きている公開URLが全員に「404 見つかりません」で表示される**。反省会当日にURLをLINEグループへ投げて全員が同時に開く、というのが想定される最初の使い方なので、遭遇確率は低くない。
  2. **計測**: `shouldCountView(ip, slug)` も同じIPで丸まるため、1スラッグあたり **5分に1回しかカウントされない**。`docs/dev-org/METRICS.md:158` と `PRD.md:162` は「`publicViewCount > 0` のセッションが3本以上」で共有2着手を判定するので、0/1の判定自体は壊れないが、`METRICS.md:210` の閲覧量の把握は系統的に過少になる。「計測したか」を判断軸にしている本プロジェクトで、計測装置が構造的に壊れているのは軽くない。
- 提案: ①`trust proxy` を有効化するだけでは Next サーバ経由の問題は解決しない（Next のサーバー`fetch`は閲覧者のIPを転送しない）。設計判断が要る。案A: 公開ページのデータ取得をクライアント側 `fetch` に寄せる（ただしOGP/SSRの利点を失う）。案B: Next 側で `x-forwarded-for` に閲覧者IPを詰めて中継し、backend で `trust proxy` を有効化（＋Next以外からのヘッダを信用しない工夫が必要）。案C: **単純化して受容する** — 「レート制限は乱用防止の粗い上限であり、上限を60→数千へ上げる」「`shouldCountView` はIPでなく `slug` ＋短い間隔のみで間引く」。S規模・想定閲覧数十件なら案Cが費用対効果で妥当と考えるが、**どれを選ぶにせよ「per-IP制限として機能している」という現在の記述（`rateLimiter.ts` 冒頭コメント・SPEC §5.4）は事実と異なるので直す必要がある**。②`Map` に破棄処理が無く無期限に増える点も同時に対処（ウィンドウ経過エントリの掃除、または上限件数）。

---

### [Major] R-04: asyncルートハンドラに try/catch もグローバルエラーハンドラも無く、DB例外でプロセスが落ちる（未認証エンドポイント追加で外部から踏まれ得るようになった）

- 場所: `backend/src/routes/public.ts:21-95`（全体が `async` でtry/catch無し）／`backend/src/routes/sessions.ts:255-347`（publish/unpublishも同様）／`backend/src/index.ts:66-72`（`app.use((err,req,res,next)=>…)` 形式のエラーハンドラが存在しないことを確認）／`backend/package.json:20`（`express@^4.19.2`）
- 確度: **CONFIRMED**（Express 4 は async ハンドラの rejection を捕捉しない。Node 20 の既定 `--unhandled-rejections=throw` により未処理rejectionはプロセス終了になる）
- 失敗シナリオ: Neonのスケールダウン明け/接続断で `prisma.session.findUnique` が reject → Express は捕まえない → 未処理rejection → **backendプロセスが落ちる** → Renderが再起動しcold start約1分（ARCH §7で許容したのは「初回アクセス時の1分」であって「閲覧中の突然死＋1分」ではない）。リクエスト側はレスポンスが返らずタイムアウト。
- なぜ今回問題かというと: この欠陥自体は既存ルートから引き継いだパターンだが、**今回初めて「認証なしで誰でも叩けるパス」がこのパターンの上に乗った**。ADR-007が変えた脅威モデルは可用性にも及ぶ。
- 提案: ①`express-async-errors` 相当を入れずに済ませるなら、最低限 `public.ts` のハンドラ全体を try/catch で包み500を返す ②`index.ts` に4引数のエラーハンドラを1つ置く ③`process.on("unhandledRejection")` でログを残して落とさない、のいずれか（①＋②推奨）。修正コードはimplementerの判断に委ねる。

---

### [Major] R-05: 公開中セッションに後から追加したトラック/注釈編集が、再同意なしで即座に外へ出る

- 場所: `backend/src/routes/public.ts:56-63`（`prisma.track.findMany({ where: { sessionId } })` — セッション内の**全**トラックを無条件に返す）／`backend/src/routes/sessions.ts` の `POST /:id/tracks`（公開状態を見ない）／`frontend/src/components/PublishDialog.tsx:170-172`（陸上移動の注意書きは**昇格ダイアログ内にしか無い**）
- 確度: **CONFIRMED**（コードパス。トラック追加側に公開状態のチェックが無いことを確認）
- 失敗シナリオ: 反省会で3艇を公開 → 翌日「もう1艇のGPXも入れておこう」と `/sessions/[id]` からトラックを追加 → **昇格ダイアログを通らないので陸上移動の警告も表示されないまま**、追加艇の航跡（自宅周辺を含む可能性）が既存の公開URLから即座に閲覧可能になる。注釈本文の `PATCH` も、公開済み注釈の中身を無審査で差し替える。
- なぜ問題か: SPEC §7が「部員の位置情報の露出」を中リスクとして挙げ、その答えを「昇格ダイアログの注意書き」に置いた。追加経路がその唯一の関門を迂回する。
- 提案: 最小対応でよい。案A: 公開中セッションへのトラック追加時にフロントで警告＋確認（「このセッションは公開中です。追加した航跡もすぐ外から見えます」）。案B: 公開中は追加トラックを既定で非公開にする（`Track` にフラグを足す＝データモデル拡張なのでYAGNI寄り、非推奨）。案C: 仕様として受容し、SPEC §7のリスク表に「公開後の追加は再同意を求めない」と明記。**A または C を推奨**（判断はimplementer/Team Lead）。

---

### [Major] R-06: 公開ページのfetchが失敗種別を握りつぶし、生きているURLを「404」または「500」にする

- 場所: `frontend/src/lib/publicSession.ts:16-21`（`if (!res.ok) return null;` — 429/500/503 を全部 null＝存在しない扱い。`fetch` 自体の throw は未捕捉）／`frontend/src/app/p/[slug]/page.tsx:60-62`（`if (!data) notFound()`）
- 確度: **CONFIRMED**（コードパス）
- 失敗シナリオ: ①backendが429（R-03）や一時的500を返す → 閲覧者には「セッションが見つかりません」。公開した本人は「消えた?」と混乱し、原因（レート制限）に到達する手がかりがゼロ ②backendがダウン/DNS失敗で `fetch` が throw → 未捕捉のまま `generateMetadata`/page が例外 → Next のエラーページ（500）。一律404の思想とも矛盾する。
- 提案: ステータスを区別する。404 → `notFound()`、それ以外（429/5xx/ネットワーク例外）→ 「一時的に表示できません。時間をおいて再度お試しください」の再試行案内ページ。**「存在しない」と「今は出せない」を混ぜない**のがここでの原則（一律404は"存在有無を隠す"ためのものであって、"障害を隠す"ためのものではない）。

---

### [Minor] R-07: 公開ペイロードに `session.id`（連番の内部ID）が含まれる

- 場所: `backend/src/lib/serializePublicSession.ts:47`
- 確度: CONFIRMED（`frontend/src/app/p/[slug]/PublicReplayView.tsx` で `session.id` を使っていないことも確認済み＝不要）
- 影響: ADR-007の「連番IDは絶対に露出させない」はURLキーについての決定だが、ペイロードに載せれば公開セッションの内部IDと総数の目安が外に出る。実害は小さい（内部APIは認証＋Team検証で守られている）が、ホワイトリスト方式の利点は「不要なものを最初から入れない」ことにあるので、使っていない値は落とすのが筋。`visibility` の同梱は `noindex` 判定に必要なので妥当（＝残してよい）。
- 提案: `session.id` をホワイトリストから外す。`tracks[].id` / `annotations[].id` は表示切替・key に必要なので残す。

### [Minor] R-08: 学びの要約の長さ判定が フロント=trim後 / バックエンド=raw で食い違う

- 場所: `backend/src/lib/validatePublishPayload.ts:26`（`learningSummary.length > 400`）／`frontend/src/lib/publish.ts:24-27`（`text.trim().length <= 400`）
- 確度: CONFIRMED（再現条件: 400字＋末尾に空白1つ）
- 影響: フロントは「公開する」ボタンを押せる状態にするが、APIが400を返し「学びの要約は400文字以内である必要があります」と表示される。境界での不可解な失敗。
- 提案: どちらかに揃える（サーバ側も `learningSummary.trim().length` で判定するのが自然。保存時は既に `trim()` している）。

### [Minor] R-09: 昇格ダイアログを開いた瞬間に `role="alert"` で「学びの要約は必須です」が読み上げられる

- 場所: `frontend/src/components/PublishDialog.tsx:110-118`（初期state `summary=""` → `summaryEmpty=true` → エラー段落が初回レンダーから存在）
- 確度: CONFIRMED
- 影響: まだ何も入力していないユーザーをエラー状態で迎える。スクリーンリーダー利用時はダイアログを開いた直後にエラーが割り込む。UI-DESIGN §7-6 の意図（重要な通知を確実に届ける）が、常時鳴るせいで薄まる。
- 提案: 「一度フォーカスを外した後」または「送信を試みた後」にのみエラーを出す（touched フラグ）。

### [Minor] R-10: `/p/` 判定が TopBar / BottomTabBar の2箇所に散っており、ページが増えると壊れやすい

- 場所: `frontend/src/components/TopBar.tsx:28`／`frontend/src/components/BottomTabBar.tsx:11`
- 確度: CONFIRMED（他ページへの副作用が無いことは確認した。`pathname?.startsWith("/p/")` は `/p/` 始まりのみに一致し、既存ルートは `/sessions` `/handbook` `/login` `/register` `/` のみ＝誤一致しない。TASKS.mdのPlaywright検証記録とも一致）
- 影響: 現時点でバグは無い。ただし「公開系ページ」が2本目（例: `/p/[slug]/embed`, 将来のチーム公開ページ `/t/[slug]`）になった時、2ファイルの条件式を同時に直す必要があり、片方を忘れると**ログイン導線が公開ページに漏れる**という R-01 と同種の事故に戻る。`BottomTabBar.tsx:11` は `pathname?.` とオプショナルにしつつ `:14` では `pathname.startsWith` と非オプショナルで、書き方も揃っていない。
- 提案: ①`config/navigation.ts` に `isPublicRoute(pathname)` を1本置いて両者から呼ぶ（最小） ②将来的には route group（`(app)` / `(public)`）でレイアウトごと分ける。今回のスコープでは①で十分。

### [Minor] R-11: `globals.css` に旧v2の死んだCSS 約1000行が残っている — 実害の判断

- 場所: `frontend/src/app/globals.css`（全3714行。`.article-card` `.question-*` `.command-palette` 等、対応ページはT-26で削除済み）
- 確度: CONFIRMED（実装者の発見事項 TASKS.md:326 の記載を突き合わせ確認）
- **実害の判断**: 現時点では **実害なし**。理由 ①該当クラスを参照するTSXが存在しない（`frontend/src/components` は4ファイルのみ、`app/` 配下も5ルートのみに縮小済み）ため誤適用は起きない ②DSトークンのエイリアス経由なので配色は自動追従し、更新漏れによる見た目のズレも起きない ③CSSはgzip後の転送増分が数KB規模で、性能上の意味も無い。**唯一のコストは可読性**（新しいクラスを足すとき既存名と衝突していないか確認する手間）。
- 提案: ADR-003の凍結コードと同じ扱いにする＝BL-01（contract migration）と同じタイミングで一括削除。**今このタイミングで消すのは反対**（デモ前の見た目の回帰リスクを、得るもの無しに背負う）。TASKS.mdの発見事項に「Team Lead判断: BL-01と同時に削除」と結論を書いて閉じるのが良い。

### [Minor] R-12: コントラストのテストが実CSSトークンを読まないため、§7-9 の回帰を捕まえられない

- 場所: `frontend/src/lib/__tests__/t9-contrast.test.ts:22-33`（`#177bae` をテスト内にハードコード）／実値は `frontend/src/app/globals.css:116`
- 確度: CONFIRMED
- 影響: 誰かが `globals.css` の `--color-accent` を別の値に戻しても、テストは `contrastRatio("#ffffff","#177bae")` を検算しているだけなので**緑のまま通る**。「壊れたら自動で気づける」になっていない。他のテスト（`t20-boat-identification`・`t31`の禁止キー再帰走査）は振る舞いを見ており良い。
- 提案: `globals.css` から `--color-accent` のdark値を読み出して検証する（正規表現1本で足りる）か、DSトークンを `design-system/theme.json` からimportして検証する。

### [Minor] R-13: UI-DESIGN §7-8 「色＋**線種**＋常時ラベル」に対し、実装は線種による艇識別を採用していない — ドキュメント側を直すのが正

- 場所: `frontend/src/lib/replay/CanvasRenderer.ts:14-16`（`setLineDash` はgaps専用と明記）／`docs/dev-org/UI-DESIGN.md` §7 項目8
- 確度: CONFIRMED（意図的な逸脱であることがコードコメントに記録されている）
- 判断: **コードが正しい**。破線は既に「欠測区間」という意味を持っており、同じ視覚チャネルに艇識別を重ねると意味が衝突する。6色化＋常時ラベルで §7-8 の目的（色以外の識別手段）は達成されている。
- 提案: UI-DESIGN §7 項目8 の文言を「色＋常時ラベル（線種は欠測表現に予約）」へ更新し、実装との齟齬を残さない。**設計逸脱として implementer に差し戻すべきではない**。

### [Minor] R-14: 投影が計算できないとき、再生ループが黙って止まりCanvasが空白のままになる

- 場所: `frontend/src/lib/replay/geo.ts:47`（点が1つも無いと `computeProjection` が `null`）／`frontend/src/app/p/[slug]/PublicReplayView.tsx:63-66`（`if (!clock || !proj …) return;` で rAF を再登録せずに終了）
- 確度: CONFIRMED（コードパス。ただし `pointCount=0` のトラックが実データに存在するかは未確認＝**発生条件の実在性は PLAUSIBLE**）
- 影響: 公開ビューが「真っ暗なCanvas＋再生ボタンは押せるが何も起きない」状態になり、エラーメッセージも出ない。部外者にとっては壊れたページに見える。
- 提案: `proj === null` のときは再生UIを出さず「この航跡は表示できません」を描画する（`/sessions/[id]` 側も同じ経路なので共通の分岐にできる）。

---

## テスト・CI の評価（カバーされていない危険な経路）

`t31-public-api.test.ts` の**禁止キー再帰走査**（`:10-23`）と「404レスポンスボディの同一性比較」（`:158-176`）は、本スライスで最も価値の高いテスト。ADR-007が要求した担保をそのまま実行可能な形にできている。以下は**未カバーで危険な経路**（qa-engineer/implementer へ）:

1. **部内API `GET /api/sessions/:id` に `publicViewCount` が含まれないこと**（R-02）— 公開APIだけが守られている
2. **公開中セッションにトラックを追加した後、公開ペイロードに即反映されること**（R-05）— 現在の挙動を「仕様」として固定するテストが無いため、意図と実装のどちらが正か記録されていない
3. **`unpublish` 後に `Annotation.isPublic` が `true` のまま残る**（`sessions.ts:340-343` は `visibility`/`publicSlug`/`publishedAt` のみ更新）— 現状は再公開時に `publish` が全件falseへ戻す（`sessions.ts:322`）ので漏洩には至らないが、**その安全性は publish 側の1行に依存している**。この依存を固定するテスト（「unpublish→publish で前回選択が引き継がれない」）が欲しい
4. **429/5xx時のフロント挙動**（R-06）— 「生きているURLが404表示になる」経路にテストが無い
5. backendのCI（`.github/workflows/test.yml:22-35`）には `npx tsc --noEmit` / `npm run build` が無い（frontendには追加済み）。型エラーがCIをすり抜ける
6. `jest --runInBand` 既定化の判断（`backend/jest.config.js:17-24`）は、根拠（3回連続再現・DB分離の費用対効果）が書かれており妥当。**この規模でこの判断を記録していることは評価できる**

---

## 観点チェックリスト（全件確認済み）

- [x] **正しさ**: 境界値を実際に追った。`getTrackEmphasis`（`CanvasRenderer.ts:38-45`）は選択0/1/3艇以上で通常描画、2艇のときのみ強調＝仕様どおりで境界バグなし。7艇以上は色が循環するが常時ラベルで識別可能（許容）。`splitByGapRuns`（`geo.ts:94-114`）は `to < from` で空配列を返し、run境界を1点重ねて線を途切れさせない実装で、gaps空配列・全区間gapの両端で破綻しない。`setLineDash` は run ごとに設定し、ループ後に `[]` へ戻している（`CanvasRenderer.ts:97`）ので他描画への漏れなし。`computeSwipeSeekStepSec`（`touchSeek.ts:20-23`）は閾値40px未満で0を返し、`clampSeekTarget` が `[0,durationSec]` にクランプ＝多指タッチ以外の破綻なし。未解決の空白ケースは R-14 のみ。
- [x] **設計逸脱**: **ADR-007「`lib/replay/` を分岐も複製もせず再利用」は守られている**。`PublicReplayView.tsx:5` は `/sessions/[id]/page.tsx` と同じ `ReplayClock`/`computeProjection`/`renderFrame`/`BOAT_COLORS` を同じ引数形で呼び、公開側の差分は `comparisonTrackIds` に空集合固定（`:22`）を渡すことと編集UIを描画しないことだけ。描画コードの分岐・複製は無い（`grep` で `lib/replay` 配下に公開用分岐が無いことも確認）。サーバ側もADR-007どおり `serializePublicSession` を新規実装し、既存整形を流用していない。逸脱はR-13（ドキュメント側を直すべき）とR-02（コードを直すべき）の2件。
- [x] **セキュリティ**: 秘密情報のハードコードなし（`publicOrigin()` は `CORS_ORIGIN` 流用、`NEXT_PUBLIC_SITE_URL` はenv）。インジェクションなし（Prismaパラメータ化、注釈`body`はReactのテキストノードとしてのみ描画＝`dangerouslySetInnerHTML` はリポジトリ内に存在しないことを確認）。認可: `POST /publish` `/unpublish` は `authMiddleware` → `requireSessionTeamMember()` → `isUploaderOrTeamAdmin()` の3段で、ARCH §4の規定どおり抜けなし（`requireTeamMember.ts:69-75`）。`GET /api/tracks/:id/gpx` は未認証404・認証済み非メンバー403（`tracks.ts:9`, `:28-31`）で、矛盾ではなく意図された使い分け（未認証に「存在するが権限が要る」を教えない）。**Blockerは R-01 のみ**。
- [x] **エラー処理**: `publicViewCount` の加算は `.catch(() => undefined)`（`public.ts:88-90`）で閲覧を止めない＝正しい割り切り。一方で握りつぶしが問題になるのは R-06、未捕捉は R-04。
- [x] **保守性**: 3ヶ月後に読める。特に「なぜそうしたか」がコメントに残っている密度が高い（`serializePublicSession.ts:1-6`, `rateLimiter.ts:1-3`, `auth.ts:27-29`）。不要な抽象化なし。懸念は R-10（散った `/p/` 判定）と R-11（死んだCSS）。
- [x] **テスト**: 上記「テスト・CI の評価」参照。

### スコープ逸脱の確認（PRD §5・SPEC §3.2「作らないもの」）— **逸脱なし**

`grep` と目視で以下の非存在を確認した: フォロー／フィード／いいね／公開側コメント（公開ビューは `<button>` によるシーク操作のみで入力欄ゼロ）／公開セッションの一覧・検索・タグ（`/p/` は動的1ルートのみ、一覧ルート無し）／チームページ・個人プロフィール（T-26で削除済み・NAV_ITEMSは2項目のみ）／公開ビューのアカウント登録導線（TopBar非表示。`PublicReplayView` に `/login` `/register` へのリンク無し）／**閲覧数のUI表示**（`grep publicViewCount frontend/src` → `types/index.ts` にも `PublicSessionResponse` にも存在しない＝ヒット0）／動的OG画像生成（静的 `og-image.png` 1枚）。R-02 は「APIに出ている」問題であって「UIに出ている」問題ではない。

### 情報漏洩の確認（`isPublic=false` はどこにも出ないか）— **出ていない**

3層すべてで確認した: ①DBクエリで `where: { isPublic: true }` に絞る（`public.ts:65`）②シリアライザが `isPublic` フィールド自体を返さない（`serializePublicSession.ts:66-72`）③Next.jsのHTML/RSCペイロードには `PublicReplayView` に渡した公開データしか載らない（`page.tsx:64` が渡すのは `fetchPublicSession` の戻り値のみ＝APIレスポンスと同一）。`__NEXT_DATA__` 相当のRSCペイロードにも、APIが返さなかったデータが入る経路は存在しない。`t31-public-api.test.ts:139-156` が非公開注釈の本文文字列がレスポンスに現れないことまで検証しており、担保として妥当。

### 404オラクルの確認 — **鍵空間を踏まえれば実害なし**

ボディ（`{"error":"セッションが見つかりません"}` 固定・`public.ts:11-13`）とステータスは、存在しない/非公開/取り消し済みで完全に同一（テストで比較検証済み）。ヘッダ差も無い（追加ヘッダを設定していない）。**応答時間には差がある**（ヒット時のみ tracks/annotations の追加クエリと数百KBのJSON生成が走る）が、`publicSlug` は `crypto.randomBytes(9)`＝72ビットで、タイミング差を使って総当たりする前提が成立しない。`unpublish` が `publicSlug` を `null` にする（`sessions.ts:341`）ため、取り消し済みスラッグは物理的にヒットしなくなる＝ここも区別不能。**スラッグ生成の衝突**（`sessions.ts:314-319` の事前チェック＋5回リトライ）は、事前チェックと `update` の間にレースがある実装だが、72ビット空間・単一インスタンス・想定件数数十本では現実に発生しない（発生時は `@unique` 違反で R-04 の経路に落ちるので、R-04の修正で十分カバーされる）。

---

## 良かった点（学習資産として言語化）

1. **「含めるものだけを列挙する」を、型定義のレベルで強制した**。`serializePublicSession.ts:8-24` は Prisma の行型ではなく**自前の `PublicSessionRow` 型**を入力に取っている。これにより、将来 `Session` にカラムが増えても、この関数のシグネチャを書き換えない限り新カラムは物理的に混入できない。ADR-007の「新カラムの既定は公開しない」という意図が、レビューや規律ではなく**型で担保**されている。ホワイトリスト方式の実装として教科書的。
2. **禁止キーの検証を「再帰走査」で書いた**（`t31-public-api.test.ts:10-23`）。`expect(res.body.session.rawGpx).toBeUndefined()` のような浅い検証だと、ネストが1段増えた瞬間に無力化する。JSON全体を潜って禁止キーの**出現パス**を返す作りは、テストが実装の細部でなく「外から見た約束（禁止キーがどこにも無い）」を検証している好例。
3. **「両方の意味を同じ視覚チャネルに載せない」という判断**（`CanvasRenderer.ts:14-16`）。仕様書（UI-DESIGN §7-8）が「線種で識別」と書いていたのに対し、破線が既にgapsの意味を持っていることを理由に採用せず、代替手段（6色化＋常時ラベル）で同じ目的を達成し、**理由をコードに残した**。仕様に従うことと目的を達成することを区別できている。
4. `jest --runInBand` の既定化（`jest.config.js:17-24`）で「3回連続再現」「失敗件数は非決定的」という**実測**を根拠に書いた上で、DB分離をS規模には過剰と判断して見送っている。計測→原因特定→対策の順序が守られている。

---

## implementer への優先順位（推奨）

1. **R-01**（Blocker・Gate解除の条件）
2. **R-03 / R-06**（デモ当日に「URLが404」で詰むのを防ぐ。R-03は案Cの単純受容でも可だが、記述の是正は必須）
3. **R-02 / R-04**（小さい修正で効果が大きい）
4. **R-05**（挙動をA案で塞ぐか、C案でSPECに書くかの判断だけでも先に）
5. Minor群（R-13・R-11 はドキュメント側の結論を書いて閉じるだけでよい）
