# ARCH — sailvlog v3（レースリプレイ・デバッガ E2本線）

<!-- 契約: 作成者 architect / 入力: PRD.md rev.3 §5（E2主役スコープ）+ RESEARCH.md（12RQ decided）+ SPIKE-01実測 / 出力先: implementer, qa-engineer -->
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
  createdAt   DateTime    @default(now())

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
  color      String? @db.VarChar(20)  // 未指定ならフロントがindexから自動割当
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

**サーバ側再検証（フロントパースを信頼しない）**: lat∈[-90,90]・lon∈[-180,180]・配列3本の長さ一致＝pointCount・startSec+pointCount≦durationSec+誤差・tSec∈[0,durationSec]・rawGpx≦5MB・gridJson≦2MB・body≦2000字。`express.json({ limit: "8mb" })` は `/api/sessions` 配下のみに適用（既存ルートのlimitは変えない）。

**フロント主要ページ**: `/sessions`（一覧）・`/sessions/new`（取込ウィザード: ファイル選択→DOMParserパース→1Hzグリッド正規化→重ね描きプレビュー→保存）・`/sessions/[id]`（再生ページ。URLクエリ `?t=秒&boats=trackId,...&leg=n` を初期化時に読み、一時停止/シーク確定時のみ `history.replaceState` で書く）。

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
- **結果として受け入れるデメリット:** 凍結コード・スキーマが当面リポジトリに残る（コードレビュー観点の「死んだコード」と緊張関係。contract完了=T-93で解消する期限付きの妥協と明記）

### ADR-004: ホスティングは Vercel（フロント）＋ Render無料Web Service（Express/Docker）＋ Neon（Postgres）
- **状況:** 反省会でURL共有するための公開ホスティング。0円目標（RQ-08）〔共通〕
- **決定:** 3サービス分割の0円構成。ExpressはDockerfileのままRenderへ。DBはNeon無料枠（0.5GB・恒久）。VercelにはNext.jsのみ
- **理由:** 5社公式調査の結論=「0円恒久」は組み合わせでのみ成立。Render無料で失効するのはPostgresだけでWeb Serviceは失効なし。ExpressのVercel載せはserverless関数化の改修＋実行時間/バンドル制約が付く（Vercel公式Express文書）ため、改修ゼロのRender別置きが優位
- **選ばなかった側の最強の擁護論:** 「3サービス分割は環境変数・CORS・デプロイ手順が3倍になる。Render一式＋有料Postgres($7/月)なら1ダッシュボードで済み、学生でも月千円は払える」— 運用簡素化として正当。ただし本プロジェクトは8週間の検証段階であり、継続が証明される前に固定費を入れるのは順序が逆。検証通過後にコスト再評価（Fly.io実費$8-12/月の試算も記録済み）、が反駁
- **結果として受け入れるデメリット:** Renderのcold start約1分（ハンドブックに「反省会前にURLを開いておく」を明記して運用で吸収）。Neonの5分スケールダウン（同様）。CORS設定の管理点が増える

### ADR-005: v2「凍結」方針とPRD v3「削除候補」の差分裁定 — Post/PostLike/Followは「凍結→安定後に削除」
- **状況:** v2の04-inventoryは「削除はしない・凍結で運用」、PRD v3はPost/PostLike/Followを削除候補と、方針が食い違う（1回目起動時の宿題）
- **決定:** 最終状態はPRD v3に従い**削除**（PRDが上位文書）。ただし削除の実行時点はv2の慎重論を取り込み、Phase 3のcontract migration（T-93）まで遅延。それまではArticle系等と同じ「ルート410・スキーマ残置」
- **理由:** 両文書の対立は「消すか」ではなく「いつ消すか」の対立と整理できる。即時削除の利益（スキーマの見通し）は小さく、遅延削除の利益（A主役転向時の可逆性・expand&contract原則との整合）が大きい。v1ロードマップ自身がPost系を却下済みのため、Article系（凍結のみ・削除予定なし）とは終着点を区別する
- **結果として受け入れるデメリット:** 「削除候補なのにまだある」期間が生じる。TASKS.mdのT-93に削除条件（Phase 1成功指標の計測開始後）を明記して曖昧化を防ぐ

### ADR-006: GPXパースはフロント（DOMParser）で実施し、サーバは構造再検証のみ
- **状況:** パース＋正規化をフロント/バックエンドどちらでやるか（RQ-06の適用位置）
- **決定:** フロントでDOMParserパース→1Hzグリッド正規化→**保存前に重ね描きプレビュー**→正規化済みJSON＋原本GPXをPOST。サーバは§4の構造検証のみ行い、XMLはパースしない
- **理由:** DOMParserはブラウザ標準・Node側には存在しない（サーバでやるならXMLライブラリ依存が増える）。取込UXの要=「アップロード前に時刻同期のズレや欠測を目視確認できるプレビュー」はフロントパースなら追加コストゼロ。パース・正規化ロジックは純関数モジュール（`lib/gpx/`）に隔離し、将来サーバ移動が必要になっても移せる形にする
- **結果として受け入れるデメリット:** クライアントを信頼しない再検証をサーバに二重で持つ（ただし検証は数値範囲チェックのみで軽い）。curl等からの直接POSTでは「gridJsonがrawGpxと整合する」ことまでは検証しない（部内認証済みユーザーのみの脅威モデルで許容。公開化する場合は再考）

## 7. リスクと縮退プラン

- **一番危ない残リスク: スマホ実機性能が未計測のまま設計を確定していること。** PC実測（M5・Headless Chrome）はPASSしたが、PRD要件「スマホでも閲覧」の実機検証はオーナー待ち（B-2）。ただし①主利用文脈はプロジェクタ/PC（PRD§3）②PC側の余裕が極端（p95 0.2ms ≒ 予算16.7msの1/80）で、ミドルレンジスマホがPCの50倍遅くてもPASS圏内、の2点からFAIL確率は低いと見積もる。**検証プラン:** `spike/README.md` の手順でオーナーがPhase 1着手前〜並行に計測（基準: 30fps/シーク1s/ロード5s/クラッシュなし）。FAIL時はSPIKE-01計画の縮退策（①描画間引き→②Path2D差分→③テール上限→④OffscreenCanvas/WebGL=新技術枠を解放）を順に適用。本線（PC）は影響を受けない
- 第2: 主役体験が並行検証でAに転ぶ → 〔共通〕タスク（T-01/T-02）は無駄にならない設計。E2固有実装はGATES ①通過を着手条件にする（TASKS.md B-1）
- 第3: JSONB応答が実データで遅い → T-24実測ガード（縮退はADR-002に記載）
- 第4: 供給リスク（マネ艇が録らない）→ 設計の外。並行検証とハンドブック（T-22）が担当
- **間に合わない場合に削る順序:** ①レグ頭出し（T-21。注釈ジャンプで代替可能）→ ②2艇比較ハイライト（T-20。艇選択の色分けで代替）→ ③URLクエリのleg/boatsパラメータ（tのみ残す）→ ④スマホ閲覧最適化（T-25。PC/プロジェクタ本線は維持）。**取込→複数艇再生→注釈→部内共有の縦1本とデモ品質は最後まで削らない**

## 8. Definition of Done

- [x] スタック選定に理由と却下案がある（§1）
- [x] 技術選定の各行が RESEARCH.md の RQ に紐づいている（§1右列・§6各ADR）
- [x] システム構成が1画面で説明できる（§2）
- [x] データモデルとI/Fが実装者が迷わない粒度である（§3 Prisma具体形・§4 検証値込み）
- [x] セキュリティ最低ラインを確認した（§5）
- [x] 重要決定がADRになっている（6件。うち5件はTeam Lead指定の必須5本: 描画方式/保存形式/基盤への載せ方/ホスティング/v2方針差分）
- [x] TASKS.md への分解が完了した
