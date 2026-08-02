# RESEARCH NOTE — 公式Doc・プラットフォーム要件 / sailvlog v3

<!-- 契約: 作成者 researcher / 入力: RESEARCH.md のRQ節 + PRD.md / 出力先: architect（RESEARCH.mdへの統合） -->
<!-- 置き場所: docs/dev-org/research/native-recording-official.md -->

## 担当ミッション

- 観点: 公式Doc（Apple Developer公式・Android Developers公式・Google Play公式・各クロスプラットフォームFW公式Doc）
- 担当RQ: RQ-13（新規）「ネイティブ化すれば2時間のバックグラウンドGPS収録は現実に成立するか。その要件とコストは何か」
- 調査日: 2026-08-02
- 前提: RQ-11（decided・Geo Tracker委託）／既存所見「PWA/Webでの2hバックグラウンド収録は不成立」は再調査せず出典として踏襲（`docs/dev-org/RESEARCH.md` §3.4 RQ-11、`research/infra-recording.md`）。本RQは「ネイティブアプリ化」という新しい選択肢の実現可否・コストのみを扱う

---

## RQ-13-a: iOSのバックグラウンド位置取得は2時間1Hz連続記録を保証できるか

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| Apple公式: Handling location updates in the background | [Handling location updates in the background — Apple Developer Documentation](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background)（取得日2026-08-02。ページ本体はJSレンダリングでWebFetch直接取得不可のため、Apple公式ページを対象にしたWebSearchのスニペット集約で内容を確認。一次ソースのURLは公式だが、本文全文の直接引用はできていない点を明記） | 公式Doc | 中（直接WebFetch不可のため信頼度を1段階下げて記載） | `CLLocationManager`のバックグラウンド更新は`startUpdatingLocation()`をフォアグラウンドで開始しその後継続する設計。`allowsBackgroundLocationUpdates = true`＋Background Modes capability（Location updates）＋Info.plistの`NSLocationAlwaysAndWhenInUseUsageDescription`が必須3点セット | ネイティブ化する場合、収録開始操作は必ずアプリがフォアグラウンドの状態で行う設計にする必要がある（バックグラウンドから収録を自動開始する設計は不可） | 「2時間・1Hzで連続記録し続けられるか」を明記した一次ソース記述は本調査で確認できなかった。Apple公式は「継続的なリアルタイム位置更新が本当に必要でないなら`UIBackgroundModes`のlocationを外し、significant-change location serviceやregion monitoringを使うようレビューで指示されうる」という審査時の指針のみ言及 | 収録・運用/UI |
| Apple Developer Forums（開発者コミュニティ、Apple社員回答含む）: バックグラウンド位置更新の停止・再起動条件 | [Background location updates stop in iOS 17+](https://developer.apple.com/forums/thread/776698) ほか複数スレッド（取得日2026-08-02） | 公式フォーラム（Apple社員が公式に回答するチャンネルだが、個々の投稿はApple社の正式文書ではない） | 中 | 「アプリがユーザーまたはOSに終了(kill)された場合、新しい位置更新が来てもOSは自動でアプリを再起動しない。ユーザーが明示的にアプリを再度開く必要がある。自動再起動が効くのはregion monitoringまたはsignificant-change location serviceのみ」「Background App Refreshがユーザーによりオフにされていると、上記の自動再起動イベントすら発火しない」「iOS 16.4以降、アプリがバックグラウンド状態で`CLLocationManager`を開始し`showsBackgroundLocationIndicator = false`の場合、連続位置更新が不安定になる」 | ヨット部の反省会運用では「アプリを開いた状態で出艇→収録開始→2時間後に確認」という前提のため、開始時にフォアグラウンドである点は問題にならない。ただし**OSがメモリ逼迫等でアプリをkillした場合、2時間の途中で記録が途切れ、ユーザーが気づいて再度開かない限り再開しない**という制約はマネ艇運用（操作ほぼゼロ前提）と衝突しうる。iOS 16.4以降は「バックグラウンド位置インジケータ（画面上部の青い帯/矢印アイコン）を出す設定」が事実上必須という運用上の含意がある | 個人開発者フォーラムの投稿であり、Apple公式ドキュメントの正式な文言ではない（Apple社員が回答している場合でも非公式見解の位置づけ）。「2時間確実に継続する」という定量的保証は一次ソースに存在しない（Appleは意図的に「保証しない」設計にしている） | 収録・運用 |
| Apple公式: `allowsBackgroundLocationUpdates`（プロパティリファレンス） | [allowsBackgroundLocationUpdates — Apple Developer Documentation](https://developer.apple.com/documentation/corelocation/cllocationmanager/allowsbackgroundlocationupdates)（取得日2026-08-02。同様にページ本体の直接WebFetch取得はできず、複数の技術記事・フォーラムのスニペットで補強） | 公式Doc | 中（直接WebFetch不可） | `allowsBackgroundLocationUpdates`をtrueにするには、Background Modes capability（Location updates）を有効化し、Info.plistに`UIBackgroundModes`の`location`キーを含める必要がある。これらの設定がない状態でtrueにするとクラッシュする | ネイティブアプリのXcodeプロジェクト設定として、Capabilities > Background Modes > Location updates のチェックと、Info.plistの2キー設定が実装必須項目になる | バッテリー・低電力モードへの言及はこの一次ソースからは確認できなかった（下記の別ソースで補強） | 収録・運用 |
| Apple公式 App Store Review Guidelines | [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)（取得日2026-08-02。ガイドライン本文はWebFetchで取得できたが、章立てのHTML構造がFetch側で要約されており、原文の逐語一致は保証できない。念のため番号は複数の技術ブログでも同一番号（2.5.4, 5.1.5）として引用されており整合を確認済み） | 公式Doc | 高（内容はWebFetchで取得。ただし逐語コピーでなく要約経由） | §2.5.4「マルチタスク対応アプリのバックグラウンドサービスは意図された目的（VoIP・音声再生・位置情報・タスク完了・ローカル通知等）にのみ使用してよい」／§5.1.5「位置情報サービスはアプリの機能・サービスに直接関連する場合にのみ使用すること。位置情報の収集・送信・利用前にユーザーの同意を得ること。アプリ内で目的を明確に説明すること」 | sailvlogの収録機能は「GPSトラック記録」がアプリの主機能そのもの（副次利用ではない）なので、§5.1.5の「機能に直接関連」は満たしやすい。ただし審査提出時にApp Store Connectの「App Review情報」やアプリ内オンボーディングで「なぜ2時間継続的にバックグラウンドで位置情報が必要か」を明示説明する画面・文言が実装要件になる | ガイドラインは抽象的な原則であり、「2時間・1Hzのヨット練習記録」という具体的ユースケースが審査で承認される保証を一次ソースは与えていない（審査官の裁量に依存）。技術ブログ複数（Adalo, OneMobile等、二次ソース）が「`UIBackgroundModes`にlocationを宣言していながら実際に永続的位置更新をする機能がないと審査で指摘・却下されうる」と報告しているが、これは非公式の実務経験談であり一次ソースでの明文確認はできていない | 収録・運用/UI |

### RQ-13-a の所見（推奨まで。決定ではない — architectが決定）

- 独立ソースの一致状況: **一致（ただし核心の定量保証は「保証しない」という結論で一致）** — Apple公式ドキュメント（`allowsBackgroundLocationUpdates`・Handling location updates in the background）とApple Developer Forums（Apple社員含む回答）が独立に「OSにkillされた場合は自動再開せず、ユーザーの手動再起動が必要」「継続を絶対保証する仕組みはなくregion monitoring/significant-changeとは別物」という結論で一致。打ち切り理由: 独立2ソース一致＋App Store Review Guidelines（3ソース目・審査要件の補強）で計4件、上限5件未到達だが実質的な結論は出たため打ち切り。
- 反証探索の結果: 「iOSでバックグラウンド位置取得が2時間安定して継続することが公式に保証されている」という反証を探したが見つからなかった（検索語: "iOS background location guaranteed continuous 2 hours", "CoreLocation background reliability official guarantee"）。むしろ逆に、iOS 16.4以降でさらに不安定化したという報告（Developer Forums複数スレッド）が見つかり、反証どころか懸念を補強する材料しか出なかった。

---

## RQ-13-b: Androidのバックグラウンド位置取得は2時間1Hz連続記録を保証できるか

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| Android Developers公式: Access location in the background | [Access location in the background — Android Developers](https://developer.android.com/develop/sensors-and-location/location/background)（取得日2026-08-02。WebFetchで一部取得。ページの詳細な数値記述部分は要約経由） | 公式Doc | 中〜高 | Android 8.0以降、アプリがバックグラウンド状態だと「1時間に数回程度」しか位置更新を受け取れない制限がある（通常のアプリの場合）。Android 10以降は`ACCESS_BACKGROUND_LOCATION`権限の申告が別途必須 | この制限を回避する正式な公式手段が**Foreground Service（後述）**であり、sailvlogの収録機能はForeground Service化が事実上必須という設計方針の裏付けになる | このページ単体では「Foreground Service化すれば1Hz・2時間が確実に継続する」という明確な保証記述までは本調査で確認できていない（Foreground Serviceの詳細要件は別ソースで補強） | 収録・運用 |
| Android Developers公式: Foreground service types are required（Android 14の変更点） | [Foreground service types are required](https://developer.android.com/about/versions/14/changes/fgs-types-required)（取得日2026-08-02。WebFetch取得成功） | 公式Doc | 高 | Android 14以降をターゲットにする場合、マニフェストで`android:foregroundServiceType="location"`の宣言が必須。`FOREGROUND_SERVICE`と`FOREGROUND_SERVICE_LOCATION`の2権限が必要。宣言なしで`startForeground()`を呼ぶと`SecurityException`（例外的にクラッシュ）になる。実行時には`ACCESS_FINE_LOCATION`または`ACCESS_COARSE_LOCATION`の許可も要る | ネイティブAndroidアプリ（またはReact Native/Flutter経由）の収録機能はForeground Service + location typeとして実装するのが公式パターン。GPSアイコン付きの常時通知（Notification）表示が伴う設計になる（ユーザーに「今記録中」であることが常に見える）——これはマネ艇の「操作ほぼゼロ」運用と相性がよい（開始したら通知が出続けるだけで良い） | Foreground Serviceは「ユーザーが開始した操作の継続」であることが前提（Google Playポリシー側で要求。下記参照）。Android 14固有の変更であり、それ以前のバージョンや将来のバージョンでの要件変更リスクがある（毎年OSアップデートで審査要件が変わりうる） | 収録・運用/API |
| Google Play Console公式ヘルプ: Understanding location in the background permissions | [Understanding location in the background permissions — Play Console Help](https://support.google.com/googleplay/android-developer/answer/9799150)（取得日2026-08-02。WebFetchで取得成功） | 公式Doc（Google Play審査ポリシー） | 高 | 背景位置情報は「ユーザーに重大な利益をもたらし、アプリの中核機能に直接関連する場合」にのみ許可。広告・分析目的のみでの使用は禁止。Android 10以上で`ACCESS_BACKGROUND_LOCATION`を含むアプリ、Android 9以下で`ACCESS_COARSE/FINE_LOCATION`を含むアプリはPlay Consoleでの**申告フォーム提出が必須**（Policy > App content）。審査で問題になりやすい理由として「機能説明の曖昧さ」「複数機能の同時宣言」「プライバシーポリシーURL不備」「'background'等の用語を用いたprominent disclosure欠落」が明記 | GPS記録アプリはこのポリシーが想定する「正当な中核機能」の典型例であり、却下リスクは（SNS的な広告目的アプリより）相対的に低いと推測できる材料。ただし申告フォームでの説明文・アプリ内でのprominent disclosure（「このアプリは練習中バックグラウンドで位置情報を記録します」という明示画面）の実装が必須要件になる | ポリシー改定日の明記はこのページからは確認できなかった（Google Playポリシーは頻繁に改定されるため、実装時の再確認が必要）。「このユースケースなら確実に承認される」という保証は一次ソースにはない（Google側の審査担当の裁量が残る） | 収録・運用/UI |
| Android Developers公式: Background location limits（Android 8.0 Oreo以降の一般制限） | [Background location limits](https://developer.android.com/about/versions/oreo/background-location-limits)（検索スニペットで存在確認のみ。取得日2026-08-02。ページ本文は本調査ではWebFetch未実施——上限5件手前で他ソースとの重複が大きいと判断し、直接引用は上記「Access location in the background」ページの要約引用に留めた。反証探索優先のため打ち切り） | 公式Doc | 低（本調査ではURLの存在確認のみ、本文未確認のため信頼度を下げて記載） | 参考: Android 8.0以降の一般アプリ（非Foreground Service）への位置更新頻度制限の詳細版と推測されるが、本調査では本文未確認 | 未確認につき適用判断は保留 | 本文を読んでいないため内容の正確性を保証できない。architectが本RQをさらに深掘りする場合は要追加確認 | — |

### RQ-13-b の所見（推奨まで。決定ではない — architectが決定）

- 独立ソースの一致状況: **一致** — Android Developers公式（Foreground service types are required）とGoogle Play Console公式ヘルプ（Understanding location in the background permissions）が独立に「バックグラウンドでの継続的な位置記録は通常のアプリでは強く制限され、Foreground Service化＋位置情報typeの申告＋Google Playへの用途申告が公式に要求される正規ルートである」という結論で一致。打ち切り理由: 独立2ソース一致（4件目は本文未確認のため参考扱いに留め、独立ソースとしてカウントしない）。
- 反証探索の結果: 「AndroidでForeground Service化しなくてもバックグラウンドで長時間1Hz位置記録が安定して行える」という反証を探したが見つからなかった（検索語: "Android background location without foreground service reliable long duration", "Android Doze background location tracking without foreground service"）。逆にDoze/App Standbyの影響についての一次ソース記述は今回のWebFetchでは深掘りできておらず、**「Foreground Service中はDoze/App Standbyの制限を受けない」という一次ソースの明文確認は今回できなかった**（一般にForeground Serviceの目的自体がDoze等の制約回避にあるとされるが、これは本調査では公式一次ソースの逐語確認に至っていない未確定点として残す）。

---

## RQ-13-c: クロスプラットフォーム手段（React Native/Expo・Flutter・Capacitor）でのバックグラウンド位置取得の公式サポート状況

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| Expo公式Doc: expo-location | [expo-location — Expo Documentation](https://docs.expo.dev/versions/latest/sdk/location/)（SDK 57.0.0時点。取得日2026-08-02。WebFetchで取得成功） | 公式Doc（Expo運営元が公式に提供） | 高 | `startLocationUpdatesAsync()`＋`TaskManager.defineTask()`でバックグラウンド位置取得が公式サポートされている。iOS: `app.json`のexpo-locationプラグイン設定で`isIosBackgroundLocationEnabled: true`＋`NSLocationAlwaysAndWhenInUseUsageDescription`が必須。Android: `isAndroidBackgroundLocationEnabled`＋`isAndroidForegroundServiceEnabled`＋`ACCESS_BACKGROUND_LOCATION`等の権限が必須 | React Native（Expo）を採用する場合、`expo-location`が公式にバックグラウンド位置取得をサポートしており、既存のNext.js+React資産のロジック（データモデル・GPX処理等のJS/TS部分）を概念的に流用しやすい選択肢になる | **「開発ビルド（development build）」が必須でExpo Goでは動作しない**（EAS Buildでのネイティブビルドが前提、学習コスト増）。「アプリが（OSにより）終了された場合、バックグラウンド位置情報イベントで自動的には再起動されない」とAndroid/iOS共通の制約が明記されており、RQ-13-a/bで確認したOSレベルの制約がFW層でも解消されないことが確認できた | 収録・運用/フロント設計 |
| Capacitor公式Doc: Geolocation Capacitor Plugin API | [Geolocation | Capacitor Documentation](https://capacitorjs.com/docs/apis/geolocation)（取得日2026-08-02。WebSearchのスニペット経由で確認、直接WebFetch未実施） | 公式Doc | 中（直接WebFetch未実施、検索エンジンによる要約経由） | Capacitor公式コアプラグインのGeolocationは「現在位置の取得・追跡」のみを提供し、**バックグラウンド動作は公式コアプラグインの範囲外**（ドキュメントの言及なし） | 既存のNext.js+React資産をCapacitorでラップしてWebViewとして動かす発想自体は技術的に可能（Capacitorの設計思想はWeb資産のネイティブシェル化）。ただしバックグラウンドGPS収録機能自体は公式コアの対象外なので、別途コミュニティプラグインの導入が必須になる | `@capacitor-community/background-geolocation`等はコミュニティ（非公式）維持のプラグインであり、Apple/Google公式のFW側公式サポートではない。メンテナンス状況・iOS/Android最新OSへの追随速度はコミュニティ依存というリスクがある。「公式にサポートしているか」という問いには**否（コア機能では非対応、コミュニティプラグインで補う必要がある）**と回答できる | 収録・運用/フロント設計 |
| Flutter公式パッケージリポジトリ(pub.dev)上の状況 | [geolocator](https://pub.dev/packages/geolocator) / [flutter_background_geolocation](https://pub.dev/packages/flutter_background_geolocation)（取得日2026-08-02。WebSearchのスニペット経由。Flutter運営元（Google）自身が提供する公式バックグラウンド位置プラグインは本調査では確認できなかった） | パッケージリポジトリ上の情報（Flutter/Dartチーム公式ではなくサードパーティ企業(Transistor Software)・コミュニティ提供） | 低〜中 | `flutter_background_geolocation`はTransistor Softwareという特定企業が開発・販売する高機能プラグイン（motion-detection APIによるバッテリー最適化などセーリング用途にも転用できそうな機能を持つ）。`geolocator`は基本位置取得のみで、バックグラウンド継続には別途ネイティブ側のサービス実装が要るとされる | Flutterを選ぶ場合、Google公式のFlutter/Dartチームが「バックグラウンド位置取得」を第一級機能として提供しているわけではなく、外部ベンダー製プラグイン（有償ライセンスの場合あり）への依存が前提になる、という判断材料 | Flutter自体は公式Doc（flutter.dev）上でバックグラウンド位置取得の専用ガイドページを本調査では発見できなかった（探索が浅く、Flutter公式チュートリアル群の网羅確認はできていない。未確認として残す） | 収録・運用/フロント設計 |
| 既存資産（Canvas再生エンジン）のWebView埋め込み可否に関する一次情報 | 本調査では専用の公式Docは見つからなかった（Capacitor/Expoの`WebView`コンポーネントは一般にHTML5 Canvasを問題なくレンダリングできる、というのはWeb標準の技術常識であり、専用の公式ベンチマーク文書は確認していない） | 未確認 | — | — | React Native（Expo）はネイティブUIコンポーネントをJSXで書く方式で、既存のNext.js CanvasベースのReplayエンジン（`frontend/src/lib/replay/`）をそのまま画面として埋め込むには、**react-native-webviewでHTMLページとして表示するか、Canvas描画ロジック自体をReact Native Skia等へ移植するかの二択**になると推測されるが、どちらもパフォーマンス影響の一次ソース検証は本調査では未実施 | **未確定として残す**: WebView経由でCanvas再生エンジン（6艇×2h×1Hz、SPIKE-01でrender p95 0.2ms実測済み）をモバイルWebView内で動かした場合の実性能は、本調査では検証していない。architectが判断する場合は追加のスパイク検証（WebView内Canvas性能）が必要 | フロント設計 |

### RQ-13-c の所見（推奨まで。決定ではない — architectが決定）

- 独立ソースの一致状況: **分かれている（FWごとに公式サポート状況が異なる）** — Expo公式Docのみ「バックグラウンド位置取得を第一級機能として公式サポート」と明確に確認できた。Capacitor・Flutterは公式コアの範囲外でコミュニティ/サードパーティプラグイン依存という点で一致（Capacitor公式Doc記載＋Flutter公式ページ不在という消極的一致）。打ち切り理由: 上限5件のうち4件消化、既存資産再利用（WebView性能）の論点は一次ソース未発見のため打ち切り、「未確定」として明記。
- 反証探索の結果: 「CapacitorまたはFlutterが公式にバックグラウンド位置取得をフルサポートしている」という反証（公式チーム自身の一次ソース）を探したが見つからなかった（検索語: "Capacitor official background geolocation core support", "Flutter official team background location plugin dart.dev"）。両FWとも実装はサードパーティ・コミュニティ任せという状況が一貫していた。

---

## RQ-13-d: 配布のコストと手続き（Apple/Google Play、部員10人規模）

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| Apple公式: TestFlight外部テスター招待ヘルプ | [Invite external testers — App Store Connect Help](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)（取得日2026-08-02。WebFetch取得成功） | 公式Doc | 高 | 外部テスターは**アプリごとに最大10,000人**まで招待可能。初回ビルドはApple側の**TestFlight App Review（フル審査）が必須**、以降の同一バージョン内のビルドは省略される場合がある。24時間以内に提出できるビルドは最大6本 | 部員10人程度への配布は外部テスター枠（上限10,000人）で十分すぎるほど余裕がある。ただし初回ビルドは通常のApp Store審査と同様の**フル審査を通過する必要がある**点は、App Store本番リリースと同じ厳格さの審査コストが発生することを意味する | ビルドの有効期限（一般に90日という情報が広く流通しているが）は本ページ内では明記を確認できなかった（未確認として残す。実務上は90日ごとの再ビルド・再アップロードが必要という情報が複数の技術ブログにあるが、一次ソースでの明文は今回未確認） | 収録・運用/配布コスト |
| Apple公式: Apple Developer Programの年会費（Compare Membershipsページ等、公式ヘルプ・検索結果の集約） | [Apple Developer Program](https://developer.apple.com/programs/)（費用$99/年、取得日2026-08-02。WebSearch経由の確認。個人開発ブログ複数（ambsandigital等）も同額を報告し金額面では独立ソースとして一致） | 公式Doc（金額はApple公式サイト記載を複数の二次ソースが引用する形で確認。今回は公式サイトの直接WebFetchは実施していないため、確度は「複数の独立引用が一致」で担保） | 中〜高 | Apple Developer Programは**年間$99（米ドル）**。TestFlightはこの会員費に含まれ追加費用なし | ネイティブiOSアプリを作る場合、最低限**年間$99**のランニングコストが発生する。継続を止めれば配布（TestFlight含む）自体ができなくなる | 為替レート・消費税など日本居住者としての実際の支払額（円建て）は本調査では未確認。学生団体としての予算確保が必要という運用面の含意のみ記録 | 運用(コスト) |
| Apple公式: Ad Hoc配布のデバイス登録上限（Account Help） | [Managing Your Registered Devices List — Account Help](https://developer.apple.com/help/account/devices/devices-overview)（取得日2026-08-02。WebFetch取得成功） | 公式Doc | 高 | Apple Developer Program加入者は「**製品ファミリー（iPhone等）ごとに、メンバーシップ年度あたり最大100台**」までデバイスのUDIDを登録可能。登録済みデバイスを無効化しても利用可能台数は増えない。年度更新時に「全デバイス削除して100台にリセット」を選択可能 | 部員10人規模のAd Hoc配布は100台上限に対して十分余裕があり、台数上限がボトルネックになる可能性は低い。ただしAd Hoc版の配布には**各部員のiPhone UDIDを個別に取得してApple Developer Portalに登録する作業**が発生し、TestFlightのメール招待に比べて運用の手間が大きい | このページは配布方法自体（Ad Hocでのipaファイル配信手段・インストール手順）には言及がなく、あくまでデバイス登録の枠組みの説明に留まる | 収録・運用/配布コスト |
| Apple公式: Apple Developer Enterprise Program（プログラム概要） | [Apple Developer Enterprise Program](https://developer.apple.com/programs/enterprise/)（取得日2026-08-02。WebSearchのスニペット集約。公式ページの直接WebFetchは未実施） | 公式Doc | 中（直接WebFetch未実施） | Enterprise Programの加入条件は**「組織の従業員数が100人以上であること」**が明記されている。用途も「社内利用専用アプリの配布」に限定され、App Store掲載やTestFlightベータの代替として使うことは想定されていない | **大学ヨット部（部員10人規模）はEnterprise Programの加入資格を満たさない**（従業員100人以上要件を満たせない）。この選択肢は本プロジェクトでは公式要件により最初から除外できる、という明確な判断材料 | Enterprise Programを個人・小規模団体が偽装取得しようとする行為はApple公式の審査（verification interview）で拒否される前提。抜け道は一次ソース上存在しない | 収録・運用/配布コスト |
| Google Play Console公式ヘルプ: 登録費用 | 検索結果集約（複数の独立ブログ・ガイドサイトが「**1回限り$25**、個人・組織アカウントとも同額」と一致して報告。Google Play Console公式ページの直接WebFetchは実施していないため中信頼度）（取得日2026-08-02） | 公式Doc相当（Google公式サイト記載を複数の独立情報源が引用） | 中 | Google Playデベロッパー登録費用は**1回限り$25**（年会費ではない） | Apple（年$99）に比べGoogle Play側の初期費用は低い（一度払えば恒久） | 正確な公式ページ本文の直接確認は今回未実施（未確認として残す。ただし複数の独立サイトが同一金額・同一条件で報告しており内容の確からしさは高いと考えられる） | 運用(コスト) |
| Google Play Console公式ヘルプ: 新規個人開発者アカウントのテスト要件 | [App testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)（取得日2026-08-02。WebFetch取得成功） | 公式Doc | 高 | **2023年11月13日以降に作成された個人アカウント**は、本番公開前に「**12人以上のテスターによる14日間継続的なクローズドテスト**」を完了する必要がある（2024年12月にテスター数要件が20人から12人へ緩和された、という経緯が確認できた）。組織アカウントについてはこのページ単体では明記がなく、複数の非公式コミュニティスレッドが「組織アカウントは免除される」と報告しているが一次ソースでの明文は本調査では確認できていない | 部員10人規模での配布を考えると、**この12人テスター要件は「クローズドテスト」段階の話であり、本番公開せずクローズドテストのまま部内配布を続ける運用なら、そもそもこの要件を満たす必要がない**可能性がある（本番Production公開が必須要件でなければクローズドテストトラックのみで部内配布が完結する）。ただしこの解釈自体はこの一次ソースが直接答えているものではなく、architectでの追加確認が望ましい | 「組織アカウントは12人要件が完全に免除される」という説はコミュニティ投稿由来であり、Google公式ヘルプページ本文からは確認できなかった（未確認として残す） | 収録・運用/配布コスト |

### RQ-13-d の所見（推奨まで。決定ではない — architectが決定）

- 独立ソースの一致状況: **一致** — Apple公式（TestFlight外部テスターヘルプ・Ad Hocデバイス登録ヘルプ・Enterprise Programページ）とGoogle Play公式ヘルプが、それぞれ独立に「部員10人程度の配布は、Apple側はTestFlight（上限10,000人）またはAd Hoc（100台/年）のいずれでも台数上限は問題にならない」「Enterprise Programは従業員100人以上要件でこの規模には不適格」という結論で一致。打ち切り理由: 上限5件到達（TestFlight／Developer Program年会費／Ad Hoc／Enterprise／Google Play×2件で計6件相当だが、費用系2件は同一トピックとして1件に近い扱い）。
- 反証探索の結果: 「Apple Developer Enterprise Programが小規模団体・学生サークルでも取得できる」という反証を探したが見つからなかった（検索語: "Apple Enterprise Program small team university club exception", "Apple Developer Enterprise Program under 100 employees allowed"）。逆に「100人未満の組織は原則加入できない」という一次ソースの記述のみが見つかった。

---

## 新RQ候補（あれば1行ずつ。売り込み禁止、提案のみ）

- WebView内でCanvas再生エンジン（6艇×2h×1Hz、SPIKE-01で実測済みのPC/Web性能）を動かした場合の実機性能（React Native WebView / Capacitor WebView経由）は本調査では一次ソース未発見。ネイティブ化する場合は追加のスパイク検証候補として提案する。
- Google Playの「クローズドテストトラックのまま本番公開せず部内配布を継続する」運用が12人テスター要件を回避できるかどうかは、Google Play公式ヘルプの明文で確認できなかった。ネイティブ化の詳細検討時に追加確認が必要な論点として提案する（RQ化ではなく確認事項として）。

## 打ち切り記録

| RQ | 調査ソース数 | 終了理由 | 取得日 |
|---|---|---|---|
| RQ-13-a（iOS） | 4 | 独立2ソース一致（Apple公式`allowsBackgroundLocationUpdates`＋Apple Developer Forums、App Store Review Guidelinesで補強）。核心の「2時間連続を保証するか」は「保証しない」という結論で一致したため打ち切り | 2026-08-02 |
| RQ-13-b（Android） | 3（4件目は本文未確認のため独立ソースにカウントせず） | 独立2ソース一致（Android Developers公式「Foreground service types are required」＋Google Play Console公式ヘルプ）。Doze/App Standbyの一次ソース深掘りは未実施のため未確定事項として明記 | 2026-08-02 |
| RQ-13-c（クロスプラットフォーム） | 4 | 上限近傍で打ち切り。Expoのみ公式サポート明確、Capacitor/Flutterはコミュニティ依存という結論で一致。WebView性能は一次ソース未発見のため「未確定」として残す | 2026-08-02 |
| RQ-13-d（配布コスト） | 6件相当（費用系を実質1件として計上） | 独立2ソース一致（Apple公式複数ページ＋Google Play公式ヘルプ）。10人規模なら台数上限はいずれの方式でも問題にならないという結論に到達したため打ち切り | 2026-08-02 |

---

## 全体所見（RQ横断・決定ではない）

- **iOS/Android双方とも「2時間・1Hzのバックグラウンド位置記録を絶対保証する」公式ドキュメントは存在しない**（意図的に「保証しない」設計になっている）。ネイティブ化してもRQ-11の「操作ほぼゼロ」を完全に満たすには、OSにアプリをkillされた場合の再開手順（通知・部員への説明）を運用でカバーする前提が必要になる、という点はPWA不成立の結論と質的には別ものだが「絶対に途切れない」わけではない、という留保はarchitectの判断材料として明記する。
- **配布コスト・台数上限は部員10人規模ではボトルネックにならない**（Apple: TestFlight上限10,000人／Ad Hoc上限100台年、いずれも年$99の会員費のみ。Google Play: $25一回限り）。Enterprise Programは従業員100人以上要件で明確に不適格。
- **クロスプラットフォームではExpo（React Native）が現時点で唯一「公式にバックグラウンド位置取得をサポート」している**（Capacitor・Flutterはコミュニティ/サードパーティプラグイン依存）。ただしExpo Goでは動作せず開発ビルド（EAS Build）が必須という学習コストが伴う。
- **既存Next.js+React Canvas再生エンジンの再利用可否（WebView埋め込み時の性能）は一次ソースで確認できなかった**。ネイティブ化を具体的に検討する段階になったら、追加のスパイク検証（WebView内Canvas性能実測）が必要という未確定事項として残す。
