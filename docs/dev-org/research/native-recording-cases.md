# RESEARCH NOTE — 実例・OSS・運用実態 / sailvlog（ネイティブ化検討: RQ-13）

<!-- 契約: 作成者 researcher(観点②) / 入力: RESEARCH.md新RQ + PRD.md / 出力先: architect（RESEARCH.mdへの統合） -->
<!-- 置き場所: docs/dev-org/research/native-recording-cases.md -->
<!-- 8フィールドの統一形式（RESEARCH-NOTE.md）に準拠。RQ-13は範囲が広いため、ミッション指定の4観点をRQ-13-A〜Dの副問いとして分割し、各々に独立打ち切り条件を適用した -->

## 担当ミッション

- 観点: 技術ブログ・事例（実例・OSS・運用実態）
- 担当RQ: RQ-13「ネイティブ化すれば2時間のバックグラウンドGPS収録は現実に成立するか。その要件とコストは何か」（4副問いA〜Dに分割して調査）
- 調査日: 2026-08-02

## 前提（公式ドキュメント観点との切り分け）

観点①（公式Doc・プラットフォーム要件）とは独立に、**「実際に作った人・使った人が何に苦しんだか」**にのみ焦点を当てた。仕様の網羅（例: iOS/AndroidのAPI仕様一覧）は行っていない。

---

## RQ-13-A: 同種アプリ（セーリングGPS/一般フィットネス）は実際どう作られ、収録面でどんな事故報告があるか

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| セーリングGPS収録の業界標準（ChartedSailsブログ、2026年時点で公開中の記事、取得日2026-08-02） | [ChartedSails: 8 ways to record GPS tracks](https://www.chartedsails.com/blog/eight-ways-to-record-gps-tracks-of-sailing-drills-and-regattas) | 技術ブログ（セーリング解析サービス運営者。一次に近い二次） | 中 | セーリング業界の実運用は「自社ネイティブアプリを新規に作る」のではなく、既存の無料GPSロガーアプリ（iOS: Open GPX Tracker／Android: GPS Logger）や専用ハード（Velocitek・Vakaros Atlas・Garmin・Apple Watch・GoPro）を組み合わせるのが標準 | sailvlogの現行決定（RQ-11: Geo Tracker等の既存アプリ指定）が業界標準と一致することの傍証になる | ネイティブ自作の苦労・コストを論じた記事ではない（推奨記事であり批判的検証なし）。「なぜ自社アプリを作らないか」への直接言及はなく推測の域 | 運用（収録ハンドブック） |
| Sailmon/Vakarosの製品構成（公式サイト＋業界ニュース、取得日2026-08-02） | [Sailmon公式](https://sailmon.com/)、[sail-world.com記事](https://www.sail-world.com/news/261882/Free-tracking-on-the-water) | 公式サイト＋業界ニュース | 中 | 専業のセーリングGPS企業（Sailmon、後にVakarosへ統合）はハードウェア＋専用ネイティブアプリのセットで展開しており、「スマホアプリ単体」を主戦場にしていない | 専業企業ですら「スマホ単体の高精度長時間収録」に全振りせずハード側に精度・信頼性を寄せている＝スマホ単体ネイティブアプリでの安定収録は専業でも簡単でない可能性の傍証 | アプリのバックグラウンド実装方式は非公開で確認不能。買収の経緯details も推測の域 | 運用 |
| raceQsの収録/閲覧分離モデル（公式サイト、取得日2026-08-02） | [raceQs公式](https://raceqs.com/) | 公式サイト | 中 | raceQsはスマホの位置ログ（専用アプリ／既存トラッカー）で収録し、Web上で3Dリプレイを見せる「収録はネイティブ/専用機器・閲覧はWeb」という分離モデル | sailvlogの現行構成（収録=Geo Tracker、閲覧=Next.js Web）が業界大手と同型であることの確認材料 | raceQs自体が収録用に自社ネイティブアプリを持つかは未確認（サイト記載のみで裏取り不十分） | 運用 |
| Stravaのバックグラウンド記録の中断報告（Apple公式コミュニティ＋Strava公式サポート文書、取得日2026-08-02） | [Apple Discussions](https://discussions.apple.com/thread/254097973)、[Strava公式サポート](https://support.strava.com/en-us/articles/15402040-troubleshooting-ios-gps-issues)、[Strava Community Hub](https://communityhub.strava.com/devices-and-connections-6/not-recording-completely-5475) | 二次（ユーザーフォーラム）＋公式サポート文書 | 中 | 独立2ソースが一致: ①ユーザー報告「60〜90分で記録が止まり『問題から回復し記録を再開しました』と表示される」②Strava公式サポート自身が「録画開始前に他アプリを閉じる」「Wi-Fi接続を切る」等の回避策を案内＝業界最大手のアプリ自身が長時間記録の不安定性を前提にした運用ガイドを出している | sailvlogの2時間収録要件は、Stravaが実際につまずいている時間域（60〜90分〜）と重なる。ネイティブ化・大手アプリでもこの種の中断リスクはゼロにならないという前提を持つべき | Strava側の具体的な実装内容（どのAPI・設定を使っているか）は非公開。GPSウォッチ連携時の話が混在しておりスマホ単体収録のみの数値ではない | 運用（収録中UIの警告・事後検証手順） |
| iOS18でのバックグラウンド位置取得の回帰報告（Apple公式デベロッパーフォーラム、取得日2026-08-02） | [Apple Developer Forums thread 773639](https://developer.apple.com/forums/thread/773639) | 一次（Apple公式デベロッパーフォーラム。開発者の投稿＋Apple DTSエンジニアの返信を含む） | 中（公式チャンネルだがApple自身も原因不明と回答した未解決バグ報告） | 公式APIどおりに実装（`allowsBackgroundLocationUpdates`等）していても、OSアップデート（iOS18・Xcode16.2再ビルド）でバックグラウンド記録が壊れる実例がある。回避策「When Using→Always」への権限変更は効く場合と効かない場合がある | 「ネイティブ実装＝公式仕様どおりで安定動作する」という前提は過信できない。OSメジャーアップデートのたびに回帰テストする運用コストが発生する | 1スレッド上の複数開発者の報告であり母集団・再現率は不明。iOS18固有の一時的な問題か将来も起き続けるかは未確定 | 運用（リリース後の継続的検証コスト） |

### RQ-13-A の所見（推奨まで。決定ではない — 決定は architect）

- 独立ソースの一致状況: **一致**（業界がスマホ単体ネイティブ自作より既存アプリ/専用ハード活用に寄る点、および大手フィットネスアプリでも長時間バックグラウンド記録が実際に途切れる点の両方で独立2ソース以上が一致）— 打ち切り理由: 独立2ソース一致（5件で打ち切り）
- 反証探索の結果: 「ネイティブアプリなら長時間バックグラウンド収録が問題なく成立する」という主張を支持する一次的な成功事例は、検索語「native sailing app 2 hour background GPS success case」「background geolocation app never fails long recording」で探したが、企業の宣伝文以上の具体的な運用実績記録は見つからなかった。ただしRQ-13-Bの Transistorsoft SDK（20,816アプリ採用の実績主張）はこの反証に近い間接的傍証として扱う（下記B参照）

---

## RQ-13-B: バックグラウンド位置取得の「実際の落とし穴」（OS/端末メーカー起因の事故報告）

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| Android端末メーカー独自の電力管理による強制終了（コミュニティ集約サイト＋実プロダクトの障害対応ブログ、取得日2026-08-02） | [dontkillmyapp.com/xiaomi](https://dontkillmyapp.com/xiaomi)、[SolutionBox実運用ブログ](https://www.solutionbox.cz/en/blog/background-location-realne-telefony) | コミュニティ集約サイト（実機検証の集積・準一次）＋技術ブログ（実プロダクトの障害対応記録） | 高（独立2ソースが数値・対処実装まで含めて一致） | Xiaomi(MIUI)・Huawei(EMUI)・OnePlus(OxygenOS)・Samsung(One UI)は独自の電力管理でフォアグラウンドサービスを画面オフ後5〜10分で強制終了する。SolutionBoxは実運用で「45分でGPSが止まる」実測と、Heartbeat監視＋ローカルSQLiteキューでの途絶検知・復旧という具体的対処を報告 | Androidネイティブ化する場合、OEM別のバッテリー最適化除外導線・キープアライブ設計・GPS途絶検知（ハートビート方式）が必須設計要素になる。公式ドキュメントだけでは足りない | 中華系Android端末に偏った報告で、iOSには適用されない。「何%の端末で発生するか」の定量データ（母集団）はない | 運用（初回セットアップ時のOEM別設定誘導）／UI（途絶時の警告）／API（欠測検知・再送） |
| Capacitor/Ionic Geolocationプラグインのバックグラウンド不具合報告（GitHub Issues＋Ionicフォーラム、取得日2026-08-02） | [capacitor#516](https://github.com/ionic-team/capacitor/issues/516)、[capacitor#3293](https://github.com/ionic-team/capacitor/issues/3293)、[Ionic Forum](https://forum.ionicframework.com/t/get-location-while-app-is-in-background-or-screen-is-locked/208732) | 一次（OSS Issue）＋二次（開発者フォーラム） | 中 | `@capacitor/geolocation`は「フォアグラウンドでは動くがバックグラウンドに回ると位置が返らない」「しばらくバックグラウンドに置いて復帰するとGPS/ネット接続が両方死ぬ」という報告が複数存在。公式標準プラグインだけでは長時間バックグラウンド収録に対応しきれず、実務では専用プラグイン（Transistorsoft等）への依存がデファクトになっている | React Native/Capacitorでの実装を選ぶ場合、標準Geolocationプラグインでは不十分で、追加の有償/専門SDK導入が前提になりうる（コスト増の可能性） | Issueは個別報告で再現条件・バージョンが揃っておらず、現行バージョンのCapacitorで解消済みかは未確認 | 運用／コスト |
| App Store審査でのバックグラウンド位置利用の正当性チェック（Apple公式デベロッパーフォーラム、取得日2026-08-02） | [Apple Developer Forums thread 771202](https://developer.apple.com/forums/thread/771202) ほかGuideline 2.5.4関連スレッド群 | 一次（Apple公式デベロッパーフォーラム） | 中 | Guideline 2.5.4は「`UIBackgroundModes`にlocationを宣言しているが、それを必要とする機能がない」場合にリジェクトする。「単なる位置追跡目的（例: 従業員追跡）」は不適切と明記されている | sailvlogのGPS収録は「マネ艇が2時間バックグラウンドで位置を録り続ける」機能そのものが目的であり、この点は審査説明文（App Review用のnotes）で明確に正当化する必要がある | この却下理由は「用途の正当性説明不足」が主因であり、sailvlogの用途自体が却下されると決まったわけではない。審査通過の確度は未検証 | 運用（App Store提出時の説明文） |
| 専用SDKでの長時間バックグラウンド収録の実績（OSS/商用製品公式リポジトリ・公式ドキュメント、取得日2026-08-02） | [transistorsoft/flutter_background_geolocation](https://github.com/transistorsoft/flutter_background_geolocation)、[Transistorsoft公式ドキュメント](https://docs.transistorsoft.com/about/) | 一次（OSS/商用製品の公式リポジトリ・公式ドキュメント） | 高 | 「20,816アプリ・142ヶ国で稼働」と主張する専用SDKが存在し、モーション検知・ジオフェンス・バッテリー効率を謳う。クロスプラットフォーム（Flutter/Cordova/RN対応あり）でも、専用の有償SDKを使えば長時間バックグラウンド収録の信頼性を確保できている例がある | 「ネイティブ化すれば自動的に解決する」わけではなく、「標準APIのままでは不十分／専用の有償SDK（本体価格$500/アプリ・リリースビルドのみ課金）を追加導入して初めて実務レベルの信頼性が出る」という前提を織り込む必要がある | 部内10人規模のプロダクトに$500/アプリのライセンス費用が見合うかは経済的判断（architectの領分）。またこの数値は製品の自己申告であり第三者機関の検証ではない | コスト／運用 |

### RQ-13-B の所見（推奨まで。決定ではない — 決定は architect）

- 独立ソースの一致状況: **一致**（Android端末メーカー起因の強制終了、Capacitor標準プラグインの不十分さ、いずれも独立2ソース以上が一致）— 打ち切り理由: 独立2ソース一致（4件で打ち切り、上限5件未到達だが決定的な追加証拠を要さないため終了）
- 反証探索の結果: 「バックグラウンドGPS収録は落とし穴だらけで実務上厳しい」という論調に対する反証として、Transistorsoftの専用SDK（20,816アプリ実績主張）を意図的に併記した。**「落とし穴は実在するが、標準APIのまま使わず専用ツール＋コストを払えば緩和できる」**という、単純な「ネイティブなら安全／不安定」の二分法を崩す事実として明記する

---

## RQ-13-C: Web資産（Next.js/React・特にCanvas高頻度描画）の再利用実績

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| Capacitor（WebView）でNext.jsアプリが同一コードのままSafari実行より大幅に遅くなった実例（Ionicフォーラム、取得日2026-08-02） | [Ionic Forum: Capacitor app significantly slower than PWA equivalent on Safari](https://forum.ionicframework.com/t/capacitor-app-significantly-slower-than-pwa-equivalent-on-safari/245474) | 二次（開発者コミュニティフォーラムの一次体験談） | 中 | Next.jsアプリ（LegendKeeper）を素のSafariで動かすと軽快だが、Capacitorでネイティブラップすると「ボタン操作・画面遷移が1〜5秒かかる」と報告。原因は未確定だがAndroidでより顕著という指摘あり | sailvlogのCanvas再生エンジン（SPIKE-01実測: render p95 0.2ms・60fps）をCapacitorでラップした場合、素のブラウザで出た性能がそのまま出る保証はない。ネイティブ化する場合はWebView経由の再計測が必須 | 1件の実例（Next.js製アプリ）であり、原因がCapacitor特有かWebView一般かは切り分けられていない。sailvlogのCanvas常時描画とはページ遷移中心の負荷特性が異なる可能性がある | UI／再生エンジン |
| React NativeでCanvas/高頻度更新を含むアプリがCPU190%に達しSwiftUIへ全面書き換えた事例（企業開発者ブログ、取得日2026-08-02） | [dev.to: We thought React Native was the answer until our app hit 190% CPU](https://dev.to/usemotion/we-thought-react-native-was-the-answer-until-our-app-hit-190-cpu-2pc3) | 二次（企業開発者ブログ、実企業の一次体験談） | 中（著者バイアスの可能性、詳細な計測手法は非開示） | ブリッジオーバーヘッド・毎秒60回超の再レンダリング・メモリリークが原因でCPU190%/メモリ400MBに達し、Swift/SwiftUIへの完全書き換えでCPU15%/メモリ100MBまで改善したと報告。RN公式も「高頻度更新はブリッジを跨ぐたびコストがかかる」ことを認めている | 高頻度描画（sailvlogのrAF＋Canvas 60fps）をReact Native経由で持ち込む場合、ブリッジ層のオーバーヘッドが性能劣化要因になりうるという点で、上記Capacitor実例と方向性が一致（独立2ソース） | Motion社のアプリはデスクトップ生産性ツールで、UIの性質（頻繁な状態更新・多数コンポーネント）がsailvlogの単一Canvas描画とは異なる。「Canvas内部はReact管理外として直接操作可能」というRESEARCH.md既存の統合判断（根拠1）はRN上でも一定成り立つ可能性があり、この記事だけで「Canvas高頻度描画がRNで詰む」とは断定できない | 再生エンジン／新技術予算判断 |
| React Native新アーキテクチャ（Fabric/JSI）による旧ブリッジ問題の解消主張（公式ドキュメント、取得日2026-08-02） | [React Native公式: Performance Overview](https://reactnative.dev/docs/performance) | 公式Doc（観点①researcherの主担当領域と重複するため参考程度に留める） | 中 | 新アーキテクチャ（Fabric+TurboModules、0.73以降安定）はJSIによる同期呼び出しで旧ブリッジの非同期オーバーヘッドを解消したと公式が主張 | RN採用を検討する場合は新アーキテクチャ前提で再検証すべきで、旧アーキテクチャ時代の悲観的事例（上記2件）をそのまま外挿しない | 公式の主張であり、Canvas高頻度描画（6艇・60fps）の実測ベンチマークは提示されていない。上記の悲観的実例も比較的新しい投稿であり、新アーキテクチャで解決済みとは言い切れない | 再生エンジン |

### RQ-13-C の所見（推奨まで。決定ではない — 決定は architect）

- 独立ソースの一致状況: **一致**（「WebView/RNブリッジは高頻度描画・高頻度更新で性能劣化要因になりうる」という方向性でCapacitor実例とReact Native実例が独立に一致）— 打ち切り理由: 独立2ソース一致（3件で打ち切り。上限5件未到達だが、これ以上探索しても「劣化しうる」以上の定量的な結論＝「sailvlogのCanvas 43,200点描画がRN/Capacitorで具体的に何fps出るか」は実測なしには出ないと判断）
- 反証探索の結果: 「ネイティブラップでも既存Web資産のパフォーマンスがそのまま出る」という主張を支持する一次的な成功事例を、検索語「Capacitor canvas 60fps success case」「React Native WebView canvas high frequency drawing no problem」で探したが、性能問題なしと明言する一次報告は見つからなかった。RN公式（新アーキテクチャ）の主張は方向としては反証寄りだが、Canvas固有の実測を伴わないため弱い反証にとどまる

---

## RQ-13-D: 小規模配布（部内10人程度）の運用実態

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| TestFlightビルド90日失効の仕組みと定期運用での回避（複数独立ブログ、取得日2026-08-02） | [photoephemeris.com](https://photoephemeris.com/en/help/general/testflight-build-has-expired/)、[techconcepts.org: TestFlight Distribution Guide](https://techconcepts.org/blog/testflight-guide) | 二次（技術解説ブログ、独立著者2件が一致） | 高 | TestFlightビルドは90日で失効し再アクティブ化不可。定期的（2〜4週間毎）に新ビルドをアップロードし続ければ失効は問題にならないという運用知見が独立に一致 | 部活の運営サイクル（週次〜月次の反省会）に合わせて定期ビルド更新の運用ルールをハンドブック化すれば90日失効自体は回避可能 | 「定期的に更新し続ける」という前提そのものが人手（オーナー/開発者）の継続コミットに依存する。学生開発者が卒業・引退すると更新が止まり失効するリスクは、いずれのブログも明記していない（sailvlog固有の懸念として別途検討要） | 運用 |
| 小規模ユーザーコミュニティでの90日失効の実体験（OSS Issue、取得日2026-08-02） | [LoopKit/Loop#2261](https://github.com/LoopKit/Loop/issues/2261) | 一次（OSS Issue、実ユーザーの投稿） | 中 | 個人開発の医療系DIYアプリ（糖尿病ループ）がTestFlightで小規模ユーザーコミュニティに配布されており、90日失効の通知にユーザーが混乱している実例。開発者側が定期的に再ビルド配布する運用で回避している実態 | sailvlogのような部内10人規模の配布も同型の「定期再ビルド配布」運用が必要になる。ハンドブックに「開発者（オーナー）が○週間ごとに再アップロードする」手順を明記する必要がある | この事例は個人開発者が継続的にメンテしている前提のプロジェクトで、大学ヨット部特有の「毎年代替わりで運用担当者が変わる」リスクへの言及はない | 運用 |
| TestFlight招待メール不達という既知の問題（技術ブログ＋Apple公式フォーラム、取得日2026-08-02） | [drizz.dev: TestFlight access](https://www.drizz.dev/post/testflight-access)、[Apple Developer Forums thread 720033](https://developer.apple.com/forums/thread/720033) | 二次（技術ブログ）＋一次（Apple公式フォーラムの複数ユーザー報告） | 中 | TestFlightの招待メールが届かない問題は「何年も続く既知の不具合」と報告されており、公開リンク（Public Link）方式に切り替えれば回避できるが誰でもインストールできてしまう（アクセス制御を失う）というトレードオフがある | 部内10人配布では招待メール不達が起きた場合の代替手順（Public Link発行、ただし限定共有の運用ルールを部内で徹底する等）をハンドブックに用意する必要 | 「何年も続く不具合」の一次的な発生率データはなく、体感報告の集積（アネクドータル）にとどまる | 運用 |
| Apple Developer Program年会費未払いによるアプリ削除の実例と制度（個人開発者の一次体験談＋複数解説記事、取得日2026-08-02） | [itch.io投稿(Vilmonic Lite開発者)](https://itch.io/post/8742362)、[Apple公式: Fee Waivers](https://developer.apple.com/help/account/membership/fee-waivers/) | 二次（個人開発者の体験談）＋一次（Apple公式ページ） | 中〜高（体験談は1件だが、削除の仕組み自体はApple公式ページで裏取り済み） | 年間$99（または$100）を払い続けられなくなると、既存インストール済みユーザーも含めてアプリがストアから消え再ダウンロード不可になる（「以前にインストール済みのユーザーも再ダウンロードできない」と開発者が明言）。学生・非営利・教育機関向けの手数料免除制度（Fee Waiver）が存在するが、要件（無料アプリ限定・認定教育機関であること等）がある | sailvlogが学連ヨット部運用として、個人開発者（オーナー）の卒業後も$99/年を払い続けられるかは運用継続性のリスク要因。Fee Waiver制度の対象要件（認定教育機関としての申請可否）を確認する価値がある | Fee Waiver制度の対象に「大学ヨット部という一学生団体（大学組織そのものではない）」が該当するかは、この体験談・公式ページからは判断できない。個別に問い合わせが必要 | 運用／コスト |

### RQ-13-D の所見（推奨まで。決定ではない — 決定は architect）

- 独立ソースの一致状況: **一致**（TestFlight90日失効の仕組み・定期更新での回避、年会費未払いでのアプリ削除、いずれも独立2ソース以上が一致）— 打ち切り理由: 独立2ソース一致（4件で打ち切り）
- 反証探索の結果: 「小規模配布はTestFlightで問題なく回っている」という反証を、検索語「TestFlight small club team 10 users no problem success story」「university club app TestFlight smooth distribution」で探したが、明確な成功体験談（苦労が全くなかったという一次報告）は見つからなかった。上記4件はいずれも何らかの運用負荷・リスクを伴うという方向で一致しており、この点については反証を見つけられなかったことを明記する

---

## 新RQ候補（あれば1行ずつ。売り込み禁止、提案のみ）

- Apple Developer Programの教育機関向けFee Waiver制度が「大学の一学生団体（大学ヨット部）」に適用可能か（該当すれば年会費$99問題の一部が解消するため、architectの判断材料になりうる）

## 打ち切り記録

| RQ | 調査ソース数 | 終了理由 | 取得日 |
|---|---|---|---|
| RQ-13-A（同種アプリの実装形態・事故報告） | 5 | 独立2ソース一致（上限5件到達） | 2026-08-02 |
| RQ-13-B（バックグラウンド位置取得の落とし穴） | 4 | 独立2ソース一致 | 2026-08-02 |
| RQ-13-C（Web資産再利用の実績） | 3 | 独立2ソース一致（これ以上は実測なしに定量結論が出ないと判断） | 2026-08-02 |
| RQ-13-D（小規模配布の運用実態） | 4 | 独立2ソース一致 | 2026-08-02 |
