# RESEARCH NOTE — 既存基盤への統合・ホスティング・モバイル収録 / sailvlog v3

<!-- 契約: 作成者 researcher / 入力: RESEARCH.md のRQ節 + PRD.md / 出力先: architect（RESEARCH.mdへの統合） -->
<!-- 置き場所: docs/dev-org/research/infra-recording.md -->

## 担当ミッション

- 観点: 公式Doc・事例中心（既存基盤への統合／ホスティング／モバイル収録）
- 担当RQ: RQ-07, RQ-08, RQ-11
- 調査日: 2026-07-24

---

## RQ-07: 既存Express/Prisma基盤への載せ方はどれか

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| Prisma公式: expand & contract パターン（データ移行ガイド） | [How to migrate data with Prisma ORM using the expand and contract pattern](https://www.prisma.io/docs/guides/data-migration)（取得日2026-07-24） | 公式Doc | 高 | 本番スキーマ変更は「新カラム/新モデルを追加（expand）→新コードに切替→旧を削除（contract）」の2段階で行い、ダウンタイム・データ不整合を避ける | 凍結対象（Article系/Question系/Course系/Reference/Post/PostLike/Follow）は「ルート無効化のみ」を先に行い、DBスキーマの物理削除（contract）は新モデル追加が安定してから後追いで別マイグレーションにする、という順序の裏付けとして引用できる | このガイドは「カラム移行」（同一エンティティ内でのデータ移動）が主題で、「エンティティ丸ごと凍結/削除」のケースそのものではない。凍結ルートの実装方法（無効化 vs 削除）自体には言及がなく、あくまで段階的変更の一般原則としての援用 | DB(migration順序)/運用(デプロイ手順) |
| Prisma公式: Prisma Migrateのメンタルモデル・チーム開発ガイド | [Team development with Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/mental-model) / [Prisma Migrate概要](https://www.prisma.io/docs/orm/prisma-migrate)（取得日2026-07-24） | 公式Doc | 高 | migrationは「schema.prismaの宣言的定義→migrate dev/deployでSQL生成→履歴はmigrationsフォルダにSQLファイルとして蓄積」という設計。history-basedなので過去のmigrationファイルは基本削除・改変しない運用が前提 | 既存アプリのmigration履歴（v1〜v2時代のもの）はそのまま残し、新モデル追加は新しいmigrationとして積み増す（(a)案 or (c)案いずれでも同じ）。凍結モデルを物理削除する場合も、削除は新しいmigrationとして追加し、既存履歴を書き換えない | 「不要になったモデルを安全に削除する」ためのPrisma公式の専用機能・ベストプラクティス文書は見つからなかった（`prisma migrate dev`は差分から自動でDROP TABLE文を生成するが、それに対する安全確認の運用は各チーム任せ） | DB(migration履歴)/運用 |
| コミュニティ記事: 本番Prismaマイグレーションのゼロダウンタイム戦略 | [Prisma Migrations in Production: Zero-Downtime Strategies and Rollback Patterns (dev.to)](https://dev.to/whoffagents/prisma-migrations-in-production-zero-downtime-strategies-and-rollback-patterns-3nf1)（取得日2026-07-24） | 技術ブログ | 中 | 破壊的変更（列/テーブル削除）は「まずコードから参照を外す→猶予期間を置く→物理削除は別マイグレーションで実施」という2段階が推奨されるとし、Prisma公式のexpand/contractと同じ結論 | RQ-07の(c)「凍結対象を物理削除してから追加」を単独ステップで一気にやるのはこの記事の推奨からも外れる。採用するなら「無効化→稼働確認→物理削除」の順に分割すべき、という判断材料になる | 個人ブログであり著者の実務経験ベース。Prisma社の見解ではない点は明記が必要（ただし内容はPrisma公式ガイドと同一方向であり独立ソースとして機能する） | DB/運用 |

### RQ-07 の所見（推奨まで。決定ではない — architectが決定）

- 独立ソースの一致状況: **一致** — Prisma公式ガイド（データ移行）とコミュニティ記事（本番運用）の2ソースが「破壊的変更は一括で行わず、無効化・移行期間・物理削除を段階分けする」という同じ結論を独立に支持。打ち切り理由: 独立2ソース一致（3ソース目のPrisma Migrate概要は補強として追加）。
- 反証探索の結果: 「モデルを一括で追加+旧モデル即削除しても問題ない」という主張を支持するソースを検索したが見つからなかった（検索語: "Prisma migrate delete model production risk", "Prisma remove unused model best practice"）。ただし本プロジェクトの規模（利用者数十人・データ量小・後方互換要求が緩い個人〜部内プロジェクト）では、公式ガイドが前提とする「本番大規模データでのダウンタイム回避」ほどの重みは必ずしもない点は architect の判断材料として付記する（このプロジェクトへの適用強度は architect が決める）。
- 補足: RQ-07自体は(a)新モデル追加+ルート無効化 / (b)アプリ別立て / (c)物理削除して追加、の3択だが、公式ソースが直接答えているのは「物理削除を一括で行うことのリスク」の部分のみ。(a)と(b)（モノリスかアプリ分離か）の判断は本調査の対象範囲外の設計スタイル論であり、一次ソースでの決定的な優劣は見つからなかった（Prisma公式ドキュメントはマルチスキーマ/マルチアプリ構成のベストプラクティスに言及なし）。

---

## RQ-08: MVPのホスティングはどれか

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| Render公式Docs: 無料プラン仕様 | [Render Docs - Free plan](https://render.com/docs/free)（取得日2026-07-24） | 公式Doc | 高 | Web Serviceの無料プランは「15分間トラフィックがないとspin down、復旧に約1分」。無料Postgresは「1GB固定容量・作成から30日で期限切れ、以後14日の猶予後に削除」。Dockerデプロイは別ドキュメント（下記）で対応確認 | 現行docker-compose(Express+Next.js)をRenderのWeb Service(Docker)としてそのままデプロイ可能。ただし無料Postgresは30日で消えるため、**MVP運用では有料Postgres($7/月〜)への切替が実質必須**、または30日ごとに手動再作成+リストアの運用が必要になる（0円目標と衝突） | 「無料でスリープする」挙動は反省会での即時URL共有（コールドスタート約1分）には許容範囲だが、DBの30日失効は学生の0円運用目標に対して致命的な制約。継続利用には最低でも有料Postgres分のコストが発生する | DB(容量・失効)/運用(コスト) |
| Render公式Docs: Dockerデプロイ | [Docker on Render](https://render.com/docs/docker) / [Deploy a Prebuilt Docker Image](https://render.com/docs/deploying-an-image)（取得日2026-07-24） | 公式Doc | 高 | リポジトリ内のDockerfileからのビルド、または既存イメージのpull、両方に対応 | 現行docker-compose.ymlのExpress用DockerfileとNext.js用Dockerfileをそれぞれ個別のWeb Serviceとしてデプロイ可能（docker-compose自体の直接インポート機能はドキュメントに記載なし＝サービスごとに手動移植が必要） | docker-composeファイルをそのまま読み込む機能は確認できず、複数コンテナ間のネットワーキング（Express↔Postgres）は環境変数での接続文字列指定に置き換える設計変更が必要 | API/DB/運用(移行作業) |
| Fly.io公式Docs: 料金体系 | [Fly.io Pricing](https://fly.io/docs/about/pricing/)（取得日2026-07-24） | 公式Doc | 高 | **2024年10月7日以降に作成した新規組織には恒久無料枠がなく、完全従量課金**。新規は2VM時間 or 7日間のトライアルのみ。最小構成Postgres(shared-cpu-1x, 256MB, 1GBボリューム)で約$2/月〜 | 0円運用目標には不適合と判断できる材料。ただし最小構成なら月$8〜12程度（アプリ+DB）で収まるという実費試算はPhase2の低コスト有料移行先の候補として記録価値あり | 「無料」の選択肢としては使えない（2024年10月7日以前作成の既存組織のみレガシー無料枠が残るが、本プロジェクトは新規なので該当しない） | 運用(コスト)/DB |
| Neon公式Pricingページ | [Neon Pricing](https://neon.com/pricing)（取得日2026-07-24） | 公式Doc | 高 | 無料枠: ストレージ0.5GB/project・コンピュート100 CU-hours/月・5分非アクティブでスケールダウン（コールドスタートあり）・上限到達で翌月までコンピュート停止・プロジェクト数上限100 | フロントVercel+DBのみNeon、という構成(RQ-08の(b))でPostgres単体は0円運用が可能。ただしExpressの置き場は別途必要（NeonはDBのみでAPIサーバーは提供しない） | 0.5GBは航跡データ(GPXのJSONB保存)次第では窮屈になりうる（6艇×2h×1Hzのセッション1件で概算数百KB〜1MB規模、数十セッションで逼迫しうる。architect側でRQ-05の保存形式決定後に容量試算が必要）。またExpress APIサーバーの置き場が別途要ることが最大の欠落点 | DB(容量上限)/運用(コールドスタート) |
| Supabase公式Pricingページ | [Supabase Pricing](https://supabase.com/pricing)（取得日2026-07-24） | 公式Doc | 高 | 無料枠: Postgres 500MB・非アクティブ1週間でプロジェクト自動pause・egress帯域5GB(+キャッシュ5GB)・無料プロジェクトは同時2つまで | Neonと同様「DBのみ0円」の選択肢。1週間放置でpauseする点はNeonの5分よりは緩いが、部活動が週1〜2回の利用頻度である本プロジェクトの実態に近い（練習日以外はアクセスなし＝毎回pause起きうる） | ExpressサーバーやNext.jsフロントの置き場を提供しない点はNeonと同じ課題。Supabase自体のBaaS機能(Auth/Realtime等)を使わずPostgresだけ使う場合、Supabaseを選ぶ積極的理由は薄い | DB(容量・pause)/運用 |
| Railway公式Docs: 無料トライアル | [Free Trial \| Railway Docs](https://docs.railway.com/pricing/free-trial)（取得日2026-07-24） | 公式Doc | 高 | 新規登録時に$5の一度きりのクレジット（30日で失効）。失効後は「Free plan」に移行し月$1のクレジットが付与されるが繰越不可 | docker-composeそのまま(Postgres+Express+Next.js)をRailwayにデプロイする構成は技術的には可能（Railwayはdocker-compose風の複数サービス構成に対応する設計思想で知られる）が、月$1のクレジットでは3サービス常時稼働のコストを賄いきれない可能性が高く、実質的に0円では続かない | 「恒久無料プラン」ではなく実質的に有料前提のトライアル型。0円運用の候補としては最弱 | 運用(コスト) |

### RQ-08 の所見（推奨まで。決定ではない — architectが決定）

- 独立ソースの一致状況: **一致（ただし「0円で完全放置運用できるものはない」という結論で一致）** — Render・Fly.io・Railway・Neon・Supabaseいずれの公式ドキュメントも「無料枠は時間制限・容量制限・スリープ/失効付き」であることで一致。打ち切り理由: 独立5ソース到達（各サービス公式ドキュメントは相互に無関係な組織であり全て独立）。
  - (a) docker-compose丸ごとPaaS: RenderはDocker対応だが無料Postgresが30日で失効＝実質0円では継続不可。Fly.ioは新規組織に無料枠自体がない。Railwayは実質トライアルのみ。
  - (b) Vercel(フロント)+マネージドPostgres(Neon/Supabase)+Express置き場が論点: DB単体は0円で回せる可能性が最も高い（NeonまたはSupabase）が、**Expressサーバーの置き場が未解決のまま残る**（VercelはServerless Functions前提でExpressのlong-running常駐プロセスとは実行モデルが異なり、今回のWebFetch調査範囲では確認できなかった。architectへの申し送り: Vercel公式のExpress対応方法（Serverless化 or Vercel外部にExpressだけ別途置く）は未調査、追加調査が必要）
  - (c) ローカル+LAN共有: 本調査の対象外（技術検証ではなく運用方針の判断のため一次ソース確認になじまない。所見のみ: 反省会の場でLAN内共有ならホスティング費用は完全0円だが、外部（部内の別日確認・卒業生等）との共有ができない制約がある）
- 反証探索の結果: 「学生個人開発が実質0円でPostgres+Express+Next.jsを恒久運用できている」という反証（0円運用が可能という主張）を探したが、各社公式ドキュメントの制限事項と矛盾する一次情報は見つからなかった（検索語: "Render free tier permanent production 2026", "run Express and Postgres for free forever 2026"）。見つかった二次情報（比較ブログ複数）も「無料枠は開発・試用向けであり本番継続運用には注意が必要」という論調で一致していた。
- 新RQ候補（1行、売り込みではなく調査中に生じた欠落確認）: 「Vercel上でExpressサーバーをどう動かすか（Serverless Functions化 or 分離ホスティング）」は本RQの範囲外の未解決点として残っている → architect/team leadで新RQ化を検討。

---

## RQ-11: モバイル収録（マネ艇・操作ほぼゼロ）の現実解はどれか

<!-- VALIDATION.md §2-1（Geo Tracker推奨・ルートヒストリー・Open GPX Tracker比較）を前提に、そこで未検証だったPWA制約と安価GPSロガーハードを補完 -->

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| VALIDATION.md §2-1（既存社内調査。再検証せず出典として引用） | `docs/dev-org/VALIDATION.md` 内、Geo Tracker公式FAQ・ルートヒストリー設定解説記事を引用 | 社内調査（一次ソース参照済み） | 高 | Geo Tracker（iOS/Android両対応・GPX/KML出力・バックグラウンド記録・記録間隔を細かく設定可）を推奨。ルートヒストリーは最短5秒間隔の制約あり、Open GPX TrackerはiOS専用だが1秒間隔可 | 既存推奨（Geo Tracker、記録間隔最短設定）をRQ-11(a)の第一候補としてそのまま踏襲する | Day 0陸上リハでの実機確認が前提（記録間隔の実挙動は端末依存とVALIDATION.md自身が明記）。本調査ではこの限界を追加で補強する必要はないと判断（既存調査で十分に一次ソース化済み） | 運用(収録手順) |
| WebKit公式ブログ: Webコンテンツの電力消費への影響 | [How Web Content Can Affect Power Usage — WebKit Blog](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/)（取得日2026-07-24） | 公式Doc相当（ブラウザベンダー公式技術ブログ） | 高 | 「ページが非アクティブになるとタイマーはスロットリングされ、CSS/SVGアニメーションは停止する。iOSではOS機能を活用し、可能な場合はタブが完全にサスペンドされる」と明記 | RQ-11(b)自前PWA案を検討する場合、「バックグラウンド（画面ロック・アプリ切替後）ではJS実行自体が止まりうる」という制約の一次的な裏付けとして使える。→ 自前PWAでの2時間バックグラウンド収録は前提から崩れるため、(b)案は「画面onのまま」という強い運用制約を課さない限り成立しないと判断できる材料 | この記事はGeolocation APIそのものへの言及はなく「タブの一般的なサスペンド挙動」の説明にとどまる。iOSの具体的な秒数（何秒でサスペンドされるか）は明記されていない | 運用(収録可否)/UI |
| 業界解説記事: iOS PWAの背景実行・位置情報制約まとめ | [Do Progressive Web Apps Work on iOS? The Complete Guide for 2026 (mobiloud.com)](https://www.mobiloud.com/blog/progressive-web-apps-ios) ほか複数の同旨記事（取得日2026-07-24） | 技術ブログ(複数の独立事業者による同旨記事) | 中 | 「iOSでもAndroidでもWeb App(PWA)はgeofencingやバックグラウンド位置情報取得をサポートしない。W3CのGeofencing API提案自体が放棄されている」と明記 | WebKit公式ブログ（タブサスペンドの一般論）と組み合わせることで、「PWAでのバックグラウンドGPS収録は技術的に成立しない」という結論をRQ-11(b)への反証根拠として使える | 事業者ブログであり一次仕様書ではない。ただし複数の独立事業者（mobiloud, vinova, tigren等）が同一の結論に達しており、W3C提案放棄という検証可能な事実を引用しているため信頼度は中程度で許容 | 運用(収録可否) |
| Velocitek公式サイト: SpeedPuck価格 | [SpeedPuck — Velocitek公式](https://www.velocitek.com/products/speedpuck)（取得日2026-07-24） | 公式Doc(製品ページ) | 高 | セーリング専用GPSロガー。公式価格$445（約65,000円台、為替次第） | RQ-11(c)「安価GPSロガーハード」の実勢価格の裏付け。**「安価」という前提を覆す発見**: ディンギー界で最も有名な専用機種でも1台$445であり、部予算での複数艇購入は現実的でない | 「数千円台のGPSロガー」というRQの想定候補とはこの製品は一致しない。より安価な汎用GPSロガー(Amazon等で数千円台の中華製ロガー)は本調査では公式一次ソースを見つけられず、価格帯の存在確認にとどまる（検索で製品カテゴリの存在は確認したが、個別製品の信頼できる一次仕様は未特定） | 運用(部予算) |
| ChartedSails（セーリング専門ブログ）: GPS記録手段8選 | [8 ways to record GPS tracks of your sailing drills and regattas](https://www.chartedsails.com/blog/eight-ways-to-record-gps-tracks-of-sailing-drills-and-regattas)（取得日2026-07-24） | 技術ブログ(セーリング専門・事例) | 中 | スマホアプリ(Open GPX Tracker/GPS Logger)、専用GPS(Velocitek ProStart/SpeedPuck、Vakaros Atlas)、スポーツウォッチ(Garmin/Apple Watch)、GoPro内蔵GPSまで8種を実際のセーリング現場での使用例として整理 | 「安価GPSロガーハード」の代替として、既存所有のGarmin/Apple Watchやアクションカメラ(GoPro5以降)がGPXまたはGPX変換可能な位置ログを取れる、という選択肢がRQ-11に追加で存在することが分かった。部員が既に持っているデバイスの転用は購入費0円の可能性がある | 記事はVelocitek/Vakaros等の具体的な価格情報を欠いており、価格比較の一次情報としては弱い。またGarmin/Apple Watch/GoProの「GPX出力可否・手順」は本調査では実機検証していない未確認事項 | 運用(収録手段の選択肢) |

### RQ-11 の所見（推奨まで。決定ではない — architectが決定）

- 独立ソースの一致状況: **一致** — (b)自前PWA案について、WebKit公式ブログ（ブラウザベンダー自身の技術説明）と業界解説記事群（複数独立事業者）が「iOS Safari/PWAはバックグラウンドでのJS実行・位置情報取得を積極的に停止する」という結論で一致。打ち切り理由: 独立2ソース一致（WebKit公式＋業界記事群を独立2件として計上、既存VALIDATION.mdの(a)調査は既に打ち切り済みのため再カウントせず）。
  - (a) 既存GPSロガーアプリ指定: VALIDATION.mdの既存調査（Geo Tracker推奨）を追認。本調査での追加変更なし。
  - (b) 自前PWA: 「iOS Safariでは画面ロック・アプリ切替後にJS実行がサスペンドされ、Geofencing APIもW3C提案自体が放棄済み」という一次ソース(WebKit公式ブログ)＋業界記事群により、**2時間の無操作バックグラウンド収録という要件には技術的に不向き**という判断材料が得られた（決定はarchitect）。画面onを維持する運用（スマホを操作せず画面だけ点灯させ続ける）なら理論上動作しうるが、防水・バッテリー・「操作ほぼゼロ」というRQの前提と衝突する。
  - (c) 安価GPSロガーハード: 想定と異なり、セーリング専用GPS(Velocitek SpeedPuck)は公式価格$445と高額で「安価」の前提に反する発見があった。一方、部員が既に所有するGarmin/Apple Watch/GoPro等の転用は購入費0円の可能性があり、RQの選択肢として追記価値がある（ただしGPX出力手順は未検証）。
- 反証探索の結果: 「iOSのPWAでもバックグラウンド位置情報の長時間取得ができる」という反証を探したが、見つからなかった（検索語: "PWA iOS background geolocation workaround 2026", "iOS Safari PWA continuous GPS tracking success"）。見つかった関連情報は全て「Wake Lock API等で画面onを維持すれば可能」という条件付きの回避策であり、「操作ほぼゼロ・バックグラウンド」という原則そのものへの反証にはならなかった。

---

## 新RQ候補（あれば1行ずつ。売り込み禁止、提案のみ）

- Vercel上でExpress（Node長時間プロセス）をどう動かすか（Serverless Functions化 or Express部分だけ別ホスティングに分離）は、RQ-08(b)の判断に必要だが本調査では一次ソース未確認。追加調査候補として提案する。
- 部員が既に所有するGarmin/Apple Watch/GoProからのGPXエクスポート手順の実機検証（RQ-11(c)の代替選択肢として、購入費0円の可能性があるため）。

## 打ち切り記録

| RQ | 調査ソース数 | 終了理由 | 取得日 |
|---|---|---|---|
| RQ-07 | 3 | 独立2ソース一致（Prisma公式データ移行ガイド＋コミュニティ実務記事が同結論。Prisma Migrate概要は補強） | 2026-07-24 |
| RQ-08 | 5 | 上限到達（Render/Fly.io/Railway/Neon/Supabase公式ドキュメント5件。全社が独立に「無料枠は制限付き」で一致し、Expressの置き場という未解決点も判明したため打ち切り） | 2026-07-24 |
| RQ-11 | 5 | 独立2ソース一致（(b)WebKit公式ブログ＋業界記事群）。加えて(a)は既存VALIDATION.md調査を追認、(c)はVelocitek公式価格とChartedSails記事で「安価」前提への反証を発見したため打ち切り | 2026-07-24 |
