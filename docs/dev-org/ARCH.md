# ARCH — sailvlog v3（レースリプレイ・デバッガ E2本線）

<!-- 契約: 作成者 architect / 入力: PRD.md rev.3 §5（E2主役スコープ）+ RESEARCH.md（12RQ中10件decided、RQ-09/10は方向decided・詳細は実装中確定=優先度「実装中可」の範囲内）+ SPIKE-01実測 / 出力先: implementer, qa-engineer -->
<!-- 完了条件: 下部のDoDが全て✅、かつ Architecture Gate 通過 -->
<!-- 前提: 主役体験は並行検証（GATES ①・〜2週間）で最終確定。本設計はE2本線だが、〔共通〕マークの判断はA主役に転んでも有効 -->

## 1. 技術スタック（選定理由つき）

| 層 | 選定 | 理由 | 却下した代替案と理由 | 根拠(RESEARCH.md) |
|---|---|---|---|---|
| フロント | Next.js 14 (App Router) + React + TypeScript — **v1続投** | 既存資産（認証UI・Team・デザイントークン）を流用。慣れているスタック | 別FWへの乗換=理由なし | 前提（RQ対象外） |
| 再生エンジン | **Canvas 2D直描き・自前実装**（無地海面＋ローカル平面投影＋スケールバー）。再生クロックはrAF＋ref、UIへは≦10Hz同期 | SPIKE-01実測で全PASS（render p95 0.2ms・シーク0.3ms・60fps）。依存ゼロ | MapLibre重畳=カスタムレイヤの毎フレーム全体再描画コスト（Mapbox #7629実報告）＋新技術枠消費。deck.gl=43,200点にWebGLは過剰。SVG+DOM=更新コスト | RQ-01, 02, 04 |
| GPXパース | ブラウザ標準DOMParserで自前（フロント）＋サーバ構造再検証 | GPX 1.1の必要要素はtrkpt@lat/lon＋timeのみ。依存ゼロで足りる | gpxparser=5年未更新。gpxjs=★34で実績薄。依存を増やす理由がない | RQ-06 |
| バックエンド | Express + Prisma + PostgreSQL — **v1モノリス続投**〔共通〕 | 稼働済み基盤に新モデルを追加する方が認証/Teamの二重管理を避けられる | アプリ別立て=規模に対し過剰 | RQ-07 |
| 状態管理 | React標準のみ（useState/useRef）。**新規ライブラリ導入ゼロ** | Zustand公式自身が高頻度更新をref+subscribeに帰着させており導入理由が消えた | Zustand/nuqs=新技術枠だけ消費 | RQ-04, 12 |
| デプロイ | フロント=Vercel Hobby / API=Render無料Web Service（Docker）/ DB=Neon無料枠 — **全構成0円**〔共通〕 | Render無料Web Serviceは失効なし（spin-downのみ）、Neonは0.5GB恒久無料。反省会前にURLを開けばcold start（〜1分）は許容 | Render無料Postgres=30日失効。Fly.io/Railway=無料枠実質なし。VercelへのExpress載せ=serverless化改修＋制約（Vercel公式Express文書） | RQ-08 |
| 収録（運用） | Geo Trackerアプリ指定（記録間隔最短・バックグラウンド収録・GPX出力）。ハンドブックで手順固定 | VALIDATION.md §2-1の一次調査を踏襲 | 自前PWA=iOSバックグラウンドJS停止で不成立（WebKit公式）。専用ハード=SpeedPuck $445で高額 | RQ-11 |

**新技術予算の裁定: 温存（消費ゼロ）。** 全レイヤがWeb標準API＋既存スタックで成立する。予算はスマホ実機計測FAIL時の縮退（OffscreenCanvas/WebGL化）のために取り置く。

## 2. システム構成

```
[マネ艇スマホ: Geo Tracker] --GPXファイル(1Hz)--> [部員のPC/スマホブラウザ]
                                                       |
        +----------------------------------------------+
        v
[Next.js on Vercel]
  /sessions/new  取込ウィザード: DOMParserパース → 1Hzグリッド正規化 → プレビュー → POST
  /sessions/[id] 再生ページ:
      lib/replay/  再生クロック(rAF+ref) → CanvasRenderer(命令的描画)
                   UIパネル(再生/倍速/シーク/艇選択/注釈)へは≦10Hzでのみ同期
      URLクエリ ?t=&boats=&leg= (一時停止/シーク確定時のみ replaceState)
        |  fetch (JWT Bearer, CORS)
        v
[Express on Render (Docker, 無料・spin-down有)]
  /api/auth /api/teams ... 既存流用
  /api/sessions*          新規（Team所属チェック必須）
  凍結ルート(articles/questions/posts/follows/courses等)は index.ts の登録解除で410
        |  Prisma (DATABASE_URL)
        v
[PostgreSQL on Neon (0.5GB 無料)]
  既存: User/Team/TeamMember/BoatType ほか（凍結モデルはスキーマ残置）
  新規: Session / Track / Annotation
```

外部依存: なし（地図タイル・外部APIゼロ。可用性リスクを反省会当日に持ち込まない）。

## 3. データモデル

新規3モデル。既存15モデルは**一切変更しない**（User/Teamにリレーション追記のみ）。凍結モデル（Article系・Question系・Course系・Post/PostLike/Follow）はスキーマ残置＝migrationは純追加（expand）。

```prisma
enum SessionType {
  practice
  race
}

model Session {
  id          Int         @id @default(autoincrement())
  title       String      @db.VarChar(255)
  type        SessionType @default(practice)
  startedAt   DateTime    // セッション基準時刻 t=0（UTC）。全Trackのオフセット基準
  durationSec Int         // タイムライン全長（秒）。上限14400(4h)をAPIで検証
  venue       String?     @db.VarChar(100)
  notes       String?     @db.Text
  marks       Json?       // [{ label: "上", lat: number, lon: number }, ...] レグ頭出し用（RQ-10）
  legs        Json?       // [{ label: "L1", startSec: number }, ...] セッション共通レグ境界（算出結果＋手動補正後）
  visibility  String      @default("team") // "team" | "unlisted" | "public"。**共有1(PRD rev.6・Phase 1最後尾)で実効化**（追補2026-07-24時点では"team"固定だった）。enum化しない理由はADR-007
  createdAt   DateTime    @default(now())

  // --- 共有1（PRD rev.6・SPEC-share1-phase1.md §4）で純追加。ADR-007 ---
  publicSlug      String?   @unique @db.VarChar(32) // crypto.randomBytes(9)のbase64url(12字)。連番IDは絶対に露出させない。非公開時null
  learningSummary String?   @db.Text                // 「学びの要約」。昇格時必須(1〜400字)・公開ビューの主役テキスト
  publishedAt     DateTime?                         // 昇格日時。取り消しでnullへ戻す
  publishedById   Int?                              // 昇格を実行したUser
  publishedBy     User?     @relation("SessionPublisher", fields: [publishedById], references: [id])
  publicViewCount Int       @default(0)             // 公開ビュー表示回数。**APIにも画面にも出さない**（PRD §5-7 非KPI。参照は運用SQLのみ）

  teamId     Int
  team       Team @relation(fields: [teamId], references: [id])
  uploaderId Int
  uploader   User @relation("SessionUploader", fields: [uploaderId], references: [id])

  tracks      Track[]
  annotations Annotation[]

  @@index([teamId, startedAt])
}

model Track {
  id        Int    @id @default(autoincrement())
  sessionId Int
  session   Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  boatLabel  String  @db.VarChar(50)  // "4423 田中/佐藤" 自由記入。Userに紐づけない（YAGNI）
  // 色カラムは持たない: 表示色はフロントがtrack indexから自動割当（ユーザー指定機能がないのに永続化しない）
  startSec   Int     // Session.startedAt からのオフセット（このグリッドの先頭時刻）
  pointCount Int     // グリッド点数。gridJson配列長と一致（サーバ検証）
  gridJson   Json    // { lat: number[], lon: number[], gaps: [number, number][] }
                     //   1Hz列指向。t[i] = startSec + i。欠測は線形補間で埋め、gapsに[開始i,終了i]を記録（UIは破線表示）
  rawGpx     String  @db.Text         // 原本GPX（無損失の正。gridは表示用キャッシュで再生成可能）
  sourceApp  String? @db.VarChar(50)  // "Geo Tracker" 等
  createdAt  DateTime @default(now())

  annotations Annotation[]
}

model Annotation {
  id        Int @id @default(autoincrement())
  sessionId Int
  session   Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  authorId  Int
  author    User @relation("AnnotationAuthor", fields: [authorId], references: [id])

  isPublic Boolean @default(false) // 共有1で純追加。**既定は非公開**。昇格ダイアログで選ばれたものだけtrue（反省会の生の議論が昇格の副作用で外に出ない構造。ADR-007）
  tSec     Int     // セッション相対秒（必須アンカー。再生位置から自動キャプチャ）
  trackId  Int?    // 対象艇（任意）
  track    Track?  @relation(fields: [trackId], references: [id], onDelete: SetNull)
  legIndex Int?    // 対象レグ（任意。Session.legs のindex参照）
  body     String  @db.Text
  createdAt DateTime @default(now())

  @@index([sessionId, tSec])
}
```

設計上の約束（RQ-05ガード）:
1. **gridJson内部をWHEREで検索するSQLは書かない。** 常にレコード丸ごと取得→アプリ側で処理（JSONBは統計を持たずプランナー最適化不能）
2. marks/legsをJsonで持つのは「要素数≦10・検索しない・セッションに従属」のため。独立テーブル化は自動検出（将来）が必要になった時点で判断
3. 容量試算: gridJson（7,200点×2配列）≈生300KB/艇・TOAST圧縮後≈100KB、rawGpx≈700KB/艇・圧縮後≈250KB → 6艇セッション≈2MB強。8週×週3回=24セッション≈50MB ≪ Neon 0.5GB。**1シーズンは余裕、翌シーズンで逼迫し始めたらrawGpxのbytea+gzip化を検討**（T-24の実測とセットで判断）

## 4. API / インターフェース設計

全て `/api/sessions` 配下・JWT必須・**呼び出しユーザーが `session.teamId` のTeamMemberであることをミドルウェアで検証**（部内限定共有の実体）。

| I/F | 入力 | 出力 | エラー時 |
|---|---|---|---|
| `POST /api/sessions` | `{ title, type, startedAt, durationSec, teamId, venue?, notes? }` | `201 { session }` | 400 バリデーション / 403 非TeamMember |
| `POST /api/sessions/:id/tracks` | `{ boatLabel, startSec, pointCount, gridJson, rawGpx, sourceApp? }`（フロントでパース済み。1艇=1リクエスト） | `201 { track }`（gridJson/rawGpx除くメタのみ返す） | 400 構造検証FAIL（下記） / 403 / 413 サイズ超過 |
| `GET /api/sessions?teamId=` | クエリ: teamId | `200 { sessions: [...] }`（メタのみ・tracks件数付き） | 403 |
| `GET /api/sessions/:id` | — | `200 { session, tracks:[{...gridJson込み, rawGpx除外}], annotations }` gzip前提。≈400KB/6艇 | 403 / 404 |
| `GET /api/tracks/:id/gpx` | — | `200 GPX原本`（Content-Disposition: attachment） | 403 / 404 |
| `PATCH /api/sessions/:id` | `{ title?, notes?, marks?, legs? }`（レグ境界の保存・補正） | `200 { session }` | 400 / 403 |
| `DELETE /api/sessions/:id` | — | `204`（Track/Annotationカスケード） | 403（uploader本人 or Team admin のみ） |
| `POST /api/sessions/:id/annotations` | `{ tSec, body, trackId?, legIndex? }` | `201 { annotation }` | 400 / 403 |
| `PATCH/DELETE /api/annotations/:id` | body更新 / 削除 | 200 / 204 | 403（author本人 or Team admin のみ） |

**共有1の追加エンドポイント（PRD rev.6・ADR-007。JWT必須の2本＋未認証1本）**

| I/F | 認証 | 入力 | 出力 | エラー |
|---|---|---|---|---|
| `POST /api/sessions/:id/publish` | JWT必須 | `{ visibility: "unlisted"\|"public", learningSummary, publicAnnotationIds: number[] }` | `200 { publicSlug, publicUrl, visibility, publishedAt }` | 400（要約が空/401字以上・visibility不正・他セッションの注釈ID混入） / 403（uploader本人でもTeam adminでもない） / 404 |
| `POST /api/sessions/:id/unpublish` | JWT必須 | — | `200 { visibility: "team" }`（**publicSlugを破棄**。再公開時は新スラッグ＝PRD §5-2の1方向解釈） | 403 / 404 |
| `GET /api/public/sessions/:slug` | **不要** | — | `200 { session, tracks, annotations }` ホワイトリスト整形。IPあたり60req/min制限 | **404のみ**（存在しない/非公開/取り消し済みを区別しない） |

**公開ペイロードから必ず除外する**（ホワイトリスト方式で「含めるものだけ」を書く。自動テストで担保＝T-31）: `rawGpx`（`GET /api/tracks/:id/gpx` も未認証では404）／`isPublic=false` の注釈（件数も出さない）／email／`teamId`・メンバー一覧（チーム表示名のみ可）／`notes`／`publicViewCount`。**`legs` は再生に必要なため含める**。

**サーバ側再検証（フロントパースを信頼しない）**: lat∈[-90,90]・lon∈[-180,180]・`gridJson.lat.length === gridJson.lon.length === pointCount`（gapsは点列と長さを揃えない別配列。各要素`[start,end]`が`0 ≦ start ≦ end < pointCount`であることを別途境界検証）・startSec+pointCount≦durationSec+誤差・tSec∈[0,durationSec]・rawGpx≦5MB・gridJson≦2MB・body≦2000字。`express.json({ limit: "8mb" })` は `/api/sessions` 配下のみに適用（既存ルートのlimitは変えない）。

**フロント主要ページ**: `/sessions`（一覧）・`/sessions/new`（取込ウィザード: ファイル選択→DOMParserパース→1Hzグリッド正規化→重ね描きプレビュー→保存）・`/sessions/[id]`（再生ページ。URLクエリ `?t=秒&boats=trackId,...&leg=n` を初期化時に読み、一時停止/シーク確定時のみ `history.replaceState` で書く）・**`/p/[slug]`（共有1の公開ビュー。認証不要・読み取り専用。`lib/replay/` をそのまま再利用し、描画コードは分岐も複製もしない。差分は「渡すデータが絞られている」ことと「編集UIを描画しない」ことだけ。`generateMetadata` でOGPを出力し、`unlisted` は `noindex`）**。

**再生エンジンモジュール境界**（実装者向け）: `frontend/src/lib/gpx/`（パース＋正規化。DOM API以外に依存しない純関数、ユニットテスト対象）と `frontend/src/lib/replay/`（ReplayClock: rAF+refの時刻管理／CanvasRenderer: 投影・艇・テール・スケールバー描画／型定義）。ReactコンポーネントはこれらをuseRef経由で保持し、UIパネルの状態同期は250ms間隔のsetIntervalまたはrAF間引きで行う。SPIKE-01（`spike/`）は**参照のみ・コピー禁止**（使い捨て契約）。

## 5. セキュリティ・運用の最低ライン

- [x] 秘密情報は環境変数 — `JWT_SECRET` / `DATABASE_URL` / `CORS_ORIGIN`。`.env.example` を両ディレクトリに整備（T-02）。Neon/Render/Vercelのダッシュボードにのみ実値を置く
- [x] 入力バリデーション — §4のサーバ側再検証（フロントのパース結果を信頼境界の外として扱う）。Prismaによりクエリはパラメータ化済み
- [x] 認可 — 全session系ルートでTeamMember検証ミドルウェア（新規 `requireTeamMember`）。削除系はuploader/author本人またはTeam admin。**注釈のXSS**: bodyはReactのテキストノードとしてのみ描画（dangerouslySetInnerHTML禁止）
- [x] 凍結ルートは410 Goneを返す薄いハンドラに置換（404でなく410にして「意図的な凍結」をログで判別可能に）
- [x] ログ/エラー通知 — M規模につきconsole＋Renderのログビューで可。JWT有効期限30mは反省会（〜2h）に短すぎるため、環境変数で2hに延長（コード変更なし）

## 6. ADR（重要な決定の記録）

### ADR-001: 再生エンジンはCanvas 2D直描き＋無地海面（地図ライブラリ不採用）
- **状況:** 6艇×2h×1Hz=43,200点を60fpsでスクラブ再生する描画方式の選定（RQ-01/02/04）
- **決定:** Canvas 2D直描き・自前実装。背景は無地海面＋メルカトル→ローカル平面投影＋スケールバー。再生クロックはReact stateの外（rAF+ref）に置き、Canvasへ命令的に描画。UIへの同期は≦10Hz
- **理由:** SPIKE-01実測が決定的（render p95 0.2ms・シーク0.3ms・縮退策不要の全PASS）。文献側も独立2ソース（Mapbox Issue #7629/#8159の「カスタムレイヤは毎フレーム地図全体を再描画」構造問題＋dev.toのCanvas/rAF原理）が地図FW重畳の構造的不利を裏付ける（MapLibre比較スパイク省略はTeam Lead受容済み）。依存ゼロで新技術予算を温存できる
- **選ばなかった側の最強の擁護論:** 「反省会では『岸からの距離』『ブローの入る岸沿い』など地形との位置関係が議論になる。無地海面ではそれが読めず、MapLibre＋タイルなら初日から解決する」— 正当な指摘。ただし現時点でその需要は未実測であり、必要になった場合も「静的タイル画像1枚を背景にキャッシュ」（RQ-02候補c）でCanvas構成のまま追加できる。エンジンをMapLibreに乗せ換える必要はない、が反駁
- **結果として受け入れるデメリット:** 地形情報ゼロ。投影・スケールバー・ヒット判定を自前保守。スマホ実機は未計測（§7）

### ADR-002: 航跡は「原本GPXテキスト＋列指向JSONB（1艇1レコード）」で保存
- **状況:** 航跡43,200点/セッションの保存形式（RQ-03/05）
- **決定:** 取込時に共通1Hzグリッドへ事前リサンプリング（欠測は線形補間＋gaps記録）し、`Track.gridJson` に列指向配列で1艇1レコード保存。原本GPXは `Track.rawGpx`（Text）に無損失保存。DBに点を行展開しない
- **理由:** 再生時はグリッドのindexアクセスのみ（SPIKE-01でシーク0.3ms実証）。TOAST劣化の文献（PostgreSQL公式/evanjones/ScaleGrid）が示す悪化条件=「集計スキャン・頻繁更新」は本用途（write-once・主キー1件フェッチ）に該当しない。グリッドは原本から再生成可能な表示用キャッシュなので、リサンプリングの情報量損失は不可逆でない
- **選ばなかった側の最強の擁護論:** 「1fix=1行なら将来の統計機能（平均艇速・タック回数の集計）がSQL一発で書け、JSONBのTOAST劣化懸念も消える」— ただしその集計需要はPRDが明示的に「作らない」（C案=自動解析ダッシュボード却下）としたもの。まだ無い問題のために毎練習4.3万行の挿入コストを払うのはYAGNI違反、が反駁
- **結果として受け入れるデメリット:** JSONB内部のSQL検索は不可（設計上の約束として禁止）。実運用データでの応答実測は未了 → T-24でガード（p95>1sならbytea圧縮/分割へ縮退）

### ADR-003: 既存モノリスへ純追加。凍結はルート登録解除（410）、物理削除はcontractで後段
- **状況:** v1のExpress/Prisma基盤（15モデル・14ルート）にv3をどう載せるか（RQ-07）〔共通: A主役でも同一判断〕
- **決定:** 同一アプリにSession/Track/Annotationを追加（expand）。凍結対象ルート（articles/questions/posts/follows/courses/likes/bookmarks/comments/tags等）は `index.ts` の登録を410ハンドラに置換。DBスキーマは残置し、物理削除は新機能安定後の別migration（contract）
- **理由:** Prisma公式expand&contract＋実務ブログの独立2ソースが「破壊的変更の段階分け」で一致。認証・Team・BoatTypeを共有するため別アプリ化は二重管理になる。本プロジェクト規模ではダウンタイム自体は問題でないが、**可逆性**（並行検証がA主役に転んだらArticle系を復活させる可能性）のために物理削除を遅延させる価値が高い
- **結果として受け入れるデメリット:** 凍結コード・スキーマが当面リポジトリに残る（コードレビュー観点の「死んだコード」と緊張関係。contract=バックログBL-01の実施で解消する条件付きの妥協と明記）

### ADR-004: ホスティングは Vercel（フロント）＋ Render無料Web Service（Express/Docker）＋ Neon（Postgres）
- **状況:** 反省会でURL共有するための公開ホスティング。0円目標（RQ-08）〔共通〕
- **決定:** 3サービス分割の0円構成。ExpressはDockerfileのままRenderへ。DBはNeon無料枠（0.5GB・恒久）。VercelにはNext.jsのみ
- **理由:** 5社公式調査の結論=「0円恒久」は組み合わせでのみ成立。Render無料で失効するのはPostgresだけでWeb Serviceは失効なし。ExpressのVercel載せはserverless関数化の改修＋実行時間/バンドル制約が付く（Vercel公式Express文書）ため、改修ゼロのRender別置きが優位
- **選ばなかった側の最強の擁護論:** 「3サービス分割は環境変数・CORS・デプロイ手順が3倍になる。Render一式＋有料Postgres($7/月)なら1ダッシュボードで済み、学生でも月千円は払える」— 運用簡素化として正当。ただし本プロジェクトは8週間の検証段階であり、継続が証明される前に固定費を入れるのは順序が逆。検証通過後にコスト再評価（Fly.io実費$8-12/月の試算も記録済み）、が反駁
- **結果として受け入れるデメリット:** Renderのcold start約1分（ハンドブックに「反省会前にURLを開いておく」を明記して運用で吸収）。Neonの5分スケールダウン（同様）。CORS設定の管理点が増える

### ADR-005: v2「凍結」方針とPRD v3「削除候補」の差分裁定 — Post/PostLike/Followは「凍結→実運用安定後・オーナー承認で削除」
- **状況:** v2の04-inventoryは「削除はしない・凍結で運用」、PRD v3はPost/PostLike/Followを削除候補と、方針が食い違う（1回目起動時の宿題）
- **決定:** 最終状態はPRD v3に従い**削除**（PRDが上位文書）。ただし削除はMVP計画に含めず、**バックログ項目BL-01**に置く。実施条件は「PRDのPhase 1（MVP・8週間）実運用の安定後」＋「オーナーの明示承認」の両方。それまではArticle系等と同じ「ルート410・スキーマ残置」
- **理由:** 両文書の対立は「消すか」ではなく「いつ消すか」の対立と整理できる。即時削除の利益（スキーマの見通し）は小さく、遅延削除の利益（A主役転向時の可逆性・expand&contract原則との整合）が大きい。削除はMVPの成功に寄与しないためMVP必須タスクにもしない（Codexレビュー2026-07-24のYAGNI指摘を採用）。v1ロードマップ自身がPost系を却下済みのため、Article系（凍結のみ・削除予定なし）とは終着点を区別する
- **結果として受け入れるデメリット:** 「削除候補なのにまだある」期間が延びる（無期限化を防ぐ装置はBL-01の実施条件明記とオーナー承認）

### ADR-006: GPXパースはフロント（DOMParser）で実施し、サーバは構造再検証のみ
- **状況:** パース＋正規化をフロント/バックエンドどちらでやるか（RQ-06の適用位置）
- **決定:** フロントでDOMParserパース→1Hzグリッド正規化→**保存前に重ね描きプレビュー**→正規化済みJSON＋原本GPXをPOST。サーバは§4の構造検証のみ行い、XMLはパースしない
- **理由:** DOMParserはブラウザ標準・Node側には存在しない（サーバでやるならXMLライブラリ依存が増える）。取込UXの要=「アップロード前に時刻同期のズレや欠測を目視確認できるプレビュー」はフロントパースなら追加コストゼロ。パース・正規化ロジックは純関数モジュール（`lib/gpx/`）に隔離し、将来サーバ移動が必要になっても移せる形にする
- **結果として受け入れるデメリット:** クライアントを信頼しない再検証をサーバに二重で持つ（ただし検証は数値範囲チェックのみで軽い）。curl等からの直接POSTでは「gridJsonがrawGpxと整合する」ことまでは検証しない（部内認証済みユーザーのみの脅威モデルで許容。公開化する場合は再考）

### ADR-007: 公開昇格は「専用スラッグ＋専用ホワイトリスト・シリアライザ」で実装し、既存の部内APIを流用しない
- **状況:** 共有1（公開昇格＋限定公開URL＋OGP）がPhase 1へ前倒しされた（PRD rev.6・`SPEC-share1-phase1.md` 承認済み）。認証必須の部内APIしか無かった系に、**初めて未認証で読めるエンドポイント**を足すことになる
- **決定:** ①URLキーは連番IDではなく `crypto.randomBytes(9)` の base64url 12文字を `Session.publicSlug` にユニーク保存 ②公開取得は `GET /api/public/sessions/:slug` を**新設**し、既存 `GET /api/sessions/:id` のレスポンス整形を再利用しない。公開ペイロードは「除外するものを列挙」ではなく「**含めるものだけを列挙するホワイトリスト方式**」で組む ③注釈の公開は `Annotation.isPublic`（既定false）で選別 ④存在しないスラッグ・非公開・取り消し済みは**区別せず一律404** ⑤IPあたり60req/minの簡易レート制限（メモリ内カウンタ・新規npm依存なし）
- **理由:** ADR-006の末尾で先送りした「公開化する場合は再考」がここで現実になった。**脅威モデルが「部内認証済みユーザーのみ」から「インターネット全体」へ変わる**ため、既存整形の流用は将来カラムが増えたときの意図しない露出を招く。ホワイトリスト方式なら、新カラムの既定は「公開しない」になる。一律404はスラッグ総当たりに手がかりを与えないため（「非公開です」は存在を教えてしまう）
- **選ばなかった側の最強の擁護論:** 「`GET /api/sessions/:id` に匿名分岐を足せば1エンドポイントで済み、再生ペイロードの整形ロジックが二重化しない」— DRYとしては正当。ただし認可分岐が1本の関数に同居すると、後日の変更で分岐を1つ踏み外しただけで全公開事故になる。**分けておけば、公開側の関数を読むだけで「何が外に出るか」が全部わかる**、が反駁（再生エンジン側=`lib/replay/` はフロントで完全に再利用するので、二重化するのはサーバの整形のみ）
- **結果として受け入れるデメリット:** サーバ側にセッション整形が2系統できる（部内用/公開用）。同期漏れは、**公開レスポンスに禁止キー（rawGpx・email・teamId・非公開注釈）が含まれないことを検証する自動テスト**（TASKS T-31）で捕まえる

### ADR-008: 6艇の識別は「6色トークン＋常時ラベル」。破線は欠測（gaps）表現に予約し艇識別には使わない
- **状況:** ③Quality Gate で仕様と実装の食い違いが発覚した。UI-DESIGN §4.2（2026-07-25確定）は「4色トークンのまま・艇index 4〜5は色再利用＋破線で線種識別」と定めたが、実装（`CanvasRenderer.ts`）は6色＋常時ラベルで、破線を艇識別に使っていない。code-reviewer は「コードが正」（REVIEW.md R-13）、並行セッションには§4.2準拠の破線実装（`getBoatLineDash`・origin上の`737b0a4`）が不採用のまま残存。どちらを正とするかの設計裁定
- **決定:** **実装側（B案）を正とする。** ①艇識別カラーはDSトークン `--color-boat-1..6` の6色（正本は `design-system/theme.json` `color.sailvlog.boats`。Canvasは常時ダークのためダーク値 `#2f9fd1/#ff5b52/#f0a72e/#34c07a/#a679e0/#e2569a` を固定使用）②`setLineDash`（破線）は**T-14以来の「欠測（gaps）区間」表現に予約**し、艇識別には使わない ③色に依存しない識別チャネルは全艇の現在位置ドット脇の**常時艇ラベル**（実装・テスト済み）が担う。識別チャネルは「6色＋ラベル」の2本に限定し、線種・マーカー形状は追加しない（チャネルを増やすほどプロジェクタ画面は読みにくくなる）
- **理由:** 決め手は**視覚チャネルの意味衝突がコード実態で確認できたこと**。`splitByGapRuns` はテールを実測(solid)/欠測(dashed `[4,3]`)のrunに分割して同一の艇色で描く。§4.2旧ルールでは艇5=boat-1色×常時破線 となり、**「艇1の欠測区間」（boat-1色×破線`[4,3]`）と「艇5の実測航跡」（boat-1色×破線`[7,4]`）が同色・破線で並ぶ**。線幅1.5px・プロジェクタ距離でダッシュピッチ差`[4,3]`vs`[7,4]`の判別は期待できず、さらに不採用実装`737b0a4`では艇5自身の欠測区間が`[4,3]`に切り替わるため「艇5の欠測」は表現不能だった。§4.2の確定（2026-07-25）は本文にgaps/欠測への言及が一切なく、**T-14（2026-07-24）で先に確定していたgaps=破線の意味付けを見落とした裁定**と判断する。色覚多様性・プロジェクタ色再現の観点でも、旧ルールは「艇1と艇5が完全同色（判別は破線のみ＝欠測と衝突済みのチャネル）」で、6色案（色は近くても同一ではない＋ラベルで確定できる）より劣る。§7項目8の目的「色だけに識別を依存させない」はラベルで達成済み。実装コストも決定的: 6色は theme.json（light/dark両系列）・`frontend/globals.css`（light/dark/`[data-theme]`の3ブロック）・`SessionPreviewCanvas`（`--color-boat-1..6`をCSS変数で読取済み）・公開ビュー・回帰テスト（`t20-boat-identification.test.ts`）まで整合済みで、A案への差し戻しは7ファイル超の変更と検証やり直しをGate中に発生させる
- **選ばなかった側の最強の擁護論（A案=4色＋破線）:** 「rev.3 DSは4色を意図して選定した。6色目のピンク`#e2569a`はダーク面で`#ff5b52`（赤）と、紫`#a679e0`は`#2f9fd1`（青）と、劣化したプロジェクタや2型色覚では接近する。4色×線種なら色空間の距離を保てる」— 色距離の指摘自体は正当。ただしその解決手段（破線）が欠測表現と衝突する以上、A案は「色の曖昧さ」を「意味の曖昧さ」に置き換えているだけ。色が接近した場合の最終判別はどちらの案でもラベルに帰着し、ラベルが機能するなら6色の方が「一致→即判別」のケースが多い、が反駁。なお C案（マーカー形状差別化）は現在位置ドットには有効だがテール（線）には効かず、新規実装＋新しい視覚語彙の学習コストが発生するため、既に動いている2チャネルで足りる現状ではYAGNI違反として却下
- **結果として受け入れるデメリット:** rev.3 DSの「艇色は4色」の意図的な絞り込みを撤回し6色に改める（theme.json は改訂済み、`design-system/styles.css` のダークブロック欠落は本ADRと同時に補完）。5・6艇目の色ペア接近リスクは残る（緩和はラベル。実プロジェクタでのデモリハ=④Demo Gateで色の判別性を目視確認する）。Team Leadの6色化指示（2026-07-25）は§4.2の既決裁定を確認せずに出された手続き違反だったが、結論としては本ADRで追認する（手続きの教訓: 既決事項の変更はADR経由で行う）

## 7. リスクと縮退プラン

- **一番危ない残リスク: スマホ実機性能が未計測のまま設計を確定していること。** PC実測（M5・Headless Chrome）はPASSしたが、PRD要件「スマホでも閲覧」の実機検証はオーナー待ち（B-2）。ただし①主利用文脈はプロジェクタ/PC（PRD§3）②PC側の余裕が極端（p95 0.2ms ≒ 予算16.7msの1/80）で、ミドルレンジスマホがPCの50倍遅くてもPASS圏内、の2点からFAIL確率は低いと見積もる。**検証プラン:** `spike/README.md` の手順でオーナーがS1（TASKS.md 実装スライス1）着手前〜並行に計測（基準: 30fps/シーク1s/ロード5s/クラッシュなし）。FAIL時はSPIKE-01計画の縮退策（①描画間引き→②Path2D差分→③テール上限→④OffscreenCanvas/WebGL=新技術枠を解放）を順に適用。本線（PC）は影響を受けない
- 第2: 主役体験が並行検証でAに転ぶ → 〔共通〕タスク（T-01/T-02）は無駄にならない設計。E2固有実装はGATES ①通過を着手条件にする（TASKS.md B-1）
- 第3: JSONB応答が実データで遅い → T-24実測ガード（縮退はADR-002に記載）
- 第4: 供給リスク（マネ艇が録らない）→ 設計の外。並行検証とハンドブック（T-22）が担当
- 第5（共有1・ADR-007）: **未認証エンドポイントからの情報露出**。縮退ではなく予防で対処する — ホワイトリスト整形＋禁止キー非含有テスト（T-31）＋一律404＋レート制限。**万一の事故時の縮退**は `POST /api/sessions/:id/unpublish` を全公開セッションに対して実行するSQL/スクリプト1本で全撤収できる（`publicSlug=null` にすれば全URLが即404になる）。この「一撃で全部引っ込められる」性質を設計上の保険として維持する（＝公開状態をSession単体で完結させ、別テーブルへ複製しない理由でもある）
- **間に合わない場合に削る順序:** ①レグ頭出し（T-21。注釈ジャンプで代替可能）→ ②2艇比較ハイライト（T-20。艇選択の色分けで代替）→ ③URLクエリのleg/boatsパラメータ（tのみ残す）→ ④スマホ閲覧最適化（T-25。PC/プロジェクタ本線は維持）。**取込→複数艇再生→注釈→部内共有の縦1本とデモ品質は最後まで削らない**

## 8. Definition of Done

- [x] スタック選定に理由と却下案がある（§1）
- [x] 技術選定の各行が RESEARCH.md の RQ に紐づいている（§1右列・§6各ADR）
- [x] システム構成が1画面で説明できる（§2）
- [x] データモデルとI/Fが実装者が迷わない粒度である（§3 Prisma具体形・§4 検証値込み）
- [x] セキュリティ最低ラインを確認した（§5）
- [x] 重要決定がADRになっている（8件。うち5件はTeam Lead指定の必須5本: 描画方式/保存形式/基盤への載せ方/ホスティング/v2方針差分。ADR-007=共有1、ADR-008=6艇識別の裁定）
- [x] TASKS.md への分解が完了した
