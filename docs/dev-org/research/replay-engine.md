# RESEARCH NOTE — 2D再生エンジン・フロントエンド設計 / sailvlog v3

<!-- 契約: 作成者 researcher / 入力: RESEARCH.md のRQ節 + PRD.md / 出力先: architect（RESEARCH.mdへの統合） -->

## 担当ミッション

- 観点: OSS実例・技術ブログ中心（2D再生エンジン・フロントエンド設計）
- 担当RQ: RQ-01, RQ-02, RQ-04, RQ-12
- 調査日: 2026-07-24

## 担当RQ一覧と打ち切り記録（先出しサマリ）

| RQ | 調査ソース数 | 終了理由 |
|---|---|---|
| RQ-01 | 4 | 独立2ソース一致（Canvas直描き優位／MapLibre系カスタムレイヤは全体再描画コストで不利）を確認した上でdeck.gl公式・OSS実例を追加確認して打ち切り |
| RQ-02 | 2 | 独立2ソース（OSM公式ポリシー・MapTiler公式）一致で打ち切り |
| RQ-04 | 4 | 独立2ソース一致（rAF+ref命令的更新が60fps要件に対する定石。Zustand公式ドキュメントでさえ高頻度更新には同じref+subscribeパターンを推奨）で打ち切り |
| RQ-12 | 2 | 独立2ソース一致（URLクエリで再生位置を運ぶのが動画・URL状態管理の慣行）で打ち切り。RQ自体が「軽く」指定のため上限を待たず終了 |

---

## RQ-01: 2D再生エンジンの描画方式はどれか（6艇×2h×1Hzを60fpsで再生・スクラブできる方式）

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| deck.gl 公式パフォーマンスガイド | [deck.gl Performance Optimization](https://deck.gl/docs/developer-guide/performance)（取得日2026-07-24） | 公式Doc | 高 | WebGL基盤のためScatterplotLayer等は数十万〜100万点まで60fps維持可能（2015年MacBook Pro基準の実測値がGitHub本体ドキュメントにも記載）。ただしaccessor関数を毎フレーム全データに対して呼ぶ実装は「数千件程度でも」stutterの原因になり、`radiusScale`等の低コストなプロパティ経由の更新が推奨されている | 43,200点規模なら理論上余裕。ただし「毎フレーム位置を再計算してaccessorに渡す」設計だと数千点規模でも詰まる、という警告はCanvas自前実装でも同じ設計原則（毎フレームの再計算コストを避ける）として転用できる | deck.glはReactラッパー込みで学習コストが新技術1枠を消費する重量級ライブラリ。43,200点程度の規模ではWebGLの必要性そのものが薄く、オーバースペックの疑いが強い | UI（描画層）、新技術予算（1枠を消費するかの判断） |
| Mapbox GL JS Issue #7629「Performance of animated custom WebGL layers」/ Issue #8159 | [github.com/mapbox/mapbox-gl-js/issues/7629](https://github.com/mapbox/mapbox-gl-js/issues/7629), [issues/8159](https://github.com/mapbox/mapbox-gl-js/issues/8159)（取得日2026-07-24。MapLibreはMapboxのフォークで同じレンダリングパイプラインを継承するため知見は転用可能、ただしMapLibre側での再現確認はしていない） | OSS Issues | 中（実装者本人の一次報告だが数値は限定的） | カスタムレイヤの`map.triggerRepaint()`はマップ全体（ベースタイル含む）の再描画を毎フレーム引き起こす。ある報告では単体シェーダーが60fps・CPU4%で動くのに、地図カスタムレイヤに組み込むと15fpsまで低下しCPU40%に跳ね上がった、という具体的な劣化率が報告されている | RQ-01(b)「MapLibre重畳」方式を採る場合、6艇のマーカー更新のたびに地図全体が再描画される構造的コストがあることを前提に設計する必要がある。無地Canvas(a)ならこの層の再描画コストがそもそも存在しない | Issue報告はMapboxでMapLibreでの直接検証ではない（バージョン差の懸念あり、フォーク時点2020年で共通コードベース）。43,200点全体でなく単一シェーダー例なので直接の数値比較はできない | UI（描画層）、性能要件（PASS基準1: 55fps以上） |
| dev.to「Why Your React App Lags but This Canvas Game Runs at 60FPS」 | [dev.to/yzbkaka_dev](https://dev.to/yzbkaka_dev/why-your-react-app-lags-but-this-canvas-game-runs-at-60fps-2h1d)（取得日2026-07-24） | 技術ブログ | 中（個人ブログ、具体的ベンチマーク数値の提示はなし・原理の説明が中心） | React管理下のDOM/Virtual DOMは状態変更のたびにスタイル再計算・レイアウト・リペイントを伴うのに対し、Canvas + rAFの命令的ループは「diffingもreconciliationもない」ため60fpsを安定して出しやすい、という設計原則を説明 | RQ-01(a)（Canvas直描き）を選ぶ根拠の一つ。特にRQ-04（状態管理）とセットで、rAFループ内で直接canvasに描画する設計がReact再レンダリングコストを回避できる | 個人ブログで実測数値の裏付けが薄い。「なぜ速いか」の定性的説明に留まり、43,200点規模での定量評価ではない | UI（描画層）、RQ-04と連動 |
| Leaflet.TrackPlayBack（GitHub OSS） | [github.com/linghuam/Leaflet.TrackPlayBack](https://github.com/linghuam/Leaflet.TrackPlayBack)（取得日2026-07-24） | OSS | 中（実在の実装例だが、README内に具体的な点数上限・fps数値の記載はなし。最終更新日も本文からは確認できず） | Leaflet地図の上でHTML5 Canvasを使ってトラック（複数可）を再生するプラグイン。「地図描画」と「動く点・線の描画」をCanvasレイヤに分離する設計思想自体は実在し、`useCanvas: true`オプションで切り替え可能な設計になっている | 「地図背景はタイルレイヤ、動く艇はCanvasオーバーレイ」というハイブリッド構成（RQ-01(b)の一種だが、mapboxのカスタムレイヤ全体再描画問題を避けるためLeaflet標準のCanvas paneに独立描画する構成）の実例として参考になる。RQ-02で無地海面(b)を採る場合は地図タイル部分が不要になり、この構成の複雑さごと不要になる | メンテナンス状況（最終コミット日・Issue解決状況）が本文情報からは確認できず、43,200点規模での実運用実績も未確認のため「動く」ことの参考にはなるが「快適に動く」ことの保証にはならない。Leaflet採用が前提（MapLibreとは別ライブラリ） | UI（描画層） |

### RQ-01 の所見（推奨まで。決定ではない — 決定は architect）

- 独立ソースの一致状況: 一致 — 「Canvas直描き(a)は React再レンダリングコスト・地図フレームワークの全体再描画コストの両方を回避できる」という点でdev.toブログとMapbox/MapLibre系Issue（構造的な設計上の弱点の指摘）が独立に支持。deck.gl公式ドキュメントは(c)WebGL経路が数値上は43,200点を十分にさばけることを示す一方、学習コストと本プロジェクトの新技術予算1枠という制約とのトレードオフになる — 打ち切り理由: 独立2ソース一致（Canvas優位の構造的理由）＋関連候補の追加確認で十分な材料が揃った
- 反証探索の結果: deck.gl公式ドキュメント自体がCanvas系の反証材料に近い（WebGLなら100万点規模でも60fps維持可能という具体的実測を提示しており、「43,200点ならCanvas一択」という結論への反証たりうる）。ただし「小規模データにWebGLが必要か」はコスト対効果の話であり、性能面の反証ではない点に注意

---

## RQ-02: 背景は地図タイルを出すか、無地海面＋スケールバーか

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| OSM Operations Working Group「Tile Usage Policy」 | [operations.osmfoundation.org/policies/tiles/](https://operations.osmfoundation.org/policies/tiles/)（取得日2026-07-24。ポリシー本文に改訂日の明記はなく、鮮度懸念として要再確認） | 公式Doc | 高 | ①独自かつライブラリのデフォルトでないUser-Agent文字列を送ること必須 ②「バルクダウンロード」の定義（現在表示中でない広域タイルの事前取得・オフライン用の一括保存・高ズームでの自動巡回）は明確に禁止 ③商用利用の明示的禁止はないが「商用・寄付を募るサービスはアクセスがいつでも遮断されうることを特に認識すべき」という警告あり ④通知なしのアクセス遮断がありうる | 部内数名が週次でリプレイを閲覧する規模（現在表示中のビューポート分のタイルのみ取得・オフライン保存機能を作らない）であれば、ポリシー上の「通常のインタラクティブな閲覧」の範囲に収まる可能性が高い。ただしMapLibreのデフォルトUser-Agentのままでは規約違反になるため、独自User-Agent設定が実装必須事項になる | 「いつでも遮断されうる」という運用リスクは残る。反省会当日にタイルが読み込めないと体験が崩れるため、無料枉タイルサーバー単体への依存は可用性リスクとして残る。学生プロジェクトが「非商用」と言えるかは自己申告であり第三者の保証はない | インフラ（可用性リスク）、UI（描画層）、運用（User-Agent設定） |
| MapTiler Cloud 公式料金ページ | [maptiler.com/cloud/pricing/](https://www.maptiler.com/cloud/pricing/)（取得日2026-07-24。価格・上限は変更されうるため実装直前の再確認を推奨） | 公式Doc | 高 | 無料プランは月間10万リクエストまで。ただし「テスト・個人利用・非商用利用向け」と明記されており商用利用は不可。地図上にMapTilerロゴの表示が必須（除去には有料プラン契約が必要） | 部内限定・非商用の学生プロジェクトという性質であれば無料枠の対象になりうる。10万リクエスト/月はタイルキャッシュ次第だが小規模利用では十分な余地がある | ロゴ表示が必須（無地デザインとの相性の問題）。「商用」の線引き（就活ポートフォリオとしての公開が商用扱いになるかは規約上グレー）は自己判断できない。運用開始後に規約変更・上限変更のリスクがある | UI（ブランディング・レイアウト）、法務・利用規約（グレーゾーンの自己判断リスク） |

### RQ-02 の所見（推奨まで。決定ではない — 決定は architect）

- 独立ソースの一致状況: 一致 — OSM・MapTilerともに「無料での地図タイル利用自体は非商用・小規模なら可能」だが「商用利用の判定が曖昧」「利用条件（User-Agent・ロゴ表示・遮断リスク）が明確に存在し無条件のフリーランチではない」という結論で一致 — 打ち切り理由: 独立2ソース（OSM公式・MapTiler公式）一致
- 反証探索の結果: 「無料タイルは実質無条件で使える」という主張に対する反証を探したが見つからなかった（検索語: "OSM tile free unlimited use no restriction"、"MapTiler free plan unlimited commercial"）。むしろ探すほど両ソースとも制約・リスクを明記しており、無条件利用を主張する情報源はなかった

---

## RQ-04: 再生状態（現在時刻・速度・選択艇）の管理方式はどれか

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| Zustand公式GitHub Discussion「mutate store state without triggering a re-render」/ pmndrs公式ドキュメントの Transient Updates | [github.com/pmndrs/zustand/issues/329](https://github.com/pmndrs/zustand/issues/329), [awesomedevin.github.io Transient Updates](https://awesomedevin.github.io/zustand-vue/en/docs/advanced/transiend-updates)（取得日2026-07-24） | 公式Doc/公式Discussion | 高（Zustand本体メンテナのDiscussion。ドキュメントサイト自体はコミュニティ派生版のため中程度の注記が必要） | Zustand自体が高頻度更新のケースでは「`subscribe`でstoreを購読しつつ`useRef`にcurrent値を保持し、re-renderを起こさず描画側だけ直接更新する」パターン（Transient Updates）を公式に推奨している。つまりZustandの標準的な`useStore`購読方式ではなく、実質的に「ref＋購読」という命令的パターンに帰着させている | 60fps更新が必要な現在時刻・艇位置についてはRQ-04(a)（rAF+ref）を採用すれば、Zustandを導入してもTransient Updatesパターンで結局同じ設計に行き着く。つまりZustandを新技術予算枠として導入する動機（60fps要件への対応）は薄く、素のuseRef+rAFで同等の効果を得られる | Zustandを他の理由（選択艇・UI状態の共有のしやすさ等）で導入する余地は残るが、「60fps再生に必要だから」という理由付けの根拠にはならない | UI（状態管理層）、新技術予算（1枠をZustandに使うかの判断） |
| dev.to「Why Your React App Lags but This Canvas Game Runs at 60FPS」（RQ-01と同一ソース、再生状態管理の文脈で再引用） | [dev.to/yzbkaka_dev](https://dev.to/yzbkaka_dev/why-your-react-app-lags-but-this-canvas-game-runs-at-60fps-2h1d)（取得日2026-07-24） | 技術ブログ | 中 | ゲームループのコード例（`requestAnimationFrame`内で計算とcanvas描画を直接行い、Reactのstate/re-renderを一切経由しない）を提示。「diffingもreconciliationもない」構成 | RQ-04(a)の実装パターンそのもの。再生クロック（現在時刻）をrefで持ち、rAFループ内でcanvas描画を命令的に更新、UIパネル（現在時刻表示等）だけ低頻度でsetStateする設計の直接的な参考実装 | 個人ブログでReact公式の裏付けではない。数値ベンチマークがない | UI（状態管理層・描画層） |
| React公式ドキュメント「Manipulating the DOM with Refs」 | [react.dev/learn/manipulating-the-dom-with-refs](https://react.dev/learn/manipulating-the-dom-with-refs)（取得日2026-07-24） | 公式Doc | 高 | 公式に「refはエスケープハッチであり、Reactの外に出る必要がある場合にのみ使うべき」と明記。ただし「Reactが更新対象にしていないDOM部分（Reactが管理しないcanvas内部の描画など）は比較的安全に直接操作できる」という指針も示されている | canvas要素自体はReactが1回だけレンダーし、その内部の描画内容（ピクセル）はReact管理外なので、rAFループでcanvas contextに直接描画するRQ-04(a)は公式ガイドラインの「安全な直接操作」の範囲に収まる | 公式ドキュメントはcanvas高頻度描画のユースケースを名指しで例示していない（フォーカス管理・スクロール・DOM測定が主な例示）。適用の妥当性はこちらの解釈による外挿 | UI（状態管理層） |
| dev.to「Animating React Without Fighting the Render Loop」（useRafFn/useRafState等の中間解を紹介） | [dev.to/childrentime](https://dev.to/childrentime/animating-react-without-fighting-the-render-loop-useraffn-userafstate-usefps-1bgn)（取得日2026-07-24） | 技術ブログ | 中 | 「全ての値をサンプリングする必要がある（最終値だけでなく）場合、useStateをそのまま使うか、refにバッファしてrAFでflushするかの二択になる」という整理。useRafStateは複数回のstate呼び出しを1フレーム1回のReact更新に間引く中間解として紹介 | 43,200点・60fps更新という要件は「全ての値をサンプリングする」側に該当するため、この記事の整理に従うとrefバッファ+rAF方式（RQ-04(a)）が適合的というのが著者の見解。UIパネル（速度表示等の低頻度部分）だけuseRafStateのような間引き更新を使う設計の余地も示唆 | 「useStateでも条件次第では成立する」という反証寄りのニュアンスも含む記事であり、100%(a)を支持する記事ではない。汎用アニメーションの文脈で書かれており、43,200点規模のレース再生に特化した検証ではない | UI（状態管理層） |

### RQ-04 の所見（推奨まで。決定ではない — 決定は architect）

- 独立ソースの一致状況: 一致 — Zustand公式のTransient Updatesパターン（ref+subscribe）とdev.to記事群（rAF+ref命令的更新）が、著者・組織が異なる独立ソースとして「60fps更新にはReact stateの外に出る設計が必要」という結論で一致。React公式ドキュメントも「canvas内部描画はReact管理外として直接操作可能」という原則面で補強する — 打ち切り理由: 独立2ソース一致（Zustand公式Discussion＋dev.toブログ2本は同一著者ではないため独立とカウント）
- 反証探索の結果: 「Zustand/useStateだけで60fpsアニメーションは十分」という明確な反証記事は見つからなかった（検索語: `"just use zustand" OR "premature optimization" react state management animation`、`React 18 useState animation 60fps fine no need for ref`）。見つかったのは「早すぎる最適化を避けよ」という一般論と、「useRafStateのような中間解もある」というニュアンス止まりで、43,200点規模の高頻度更新に対してuseState/Zustandの素の購読方式で十分と主張する情報源はなかった

---

## RQ-12: 注釈込みURL共有の状態の持ち方はどれか

### 調査項目テーブル

| 調査対象 | 情報源(URL/論文名/リポジトリ名) | 種類 | 信頼度(高/中/低) | 参考になる設計 | 自プロジェクトへの適用方法 | そのまま採用できない点 | 影響先(DB/API/UI/運用) |
|---|---|---|---|---|---|---|---|
| YouTubeの`?t=`タイムスタンプ共有慣行（Android Authority等の複数メディアが報じるYouTube公式機能の説明） | [androidauthority.com](https://www.androidauthority.com/video-timestamps-youtube-mobile-3475237/)、[9to5google.com](https://9to5google.com/2024/08/26/youtube-mobile-adds-share-sheet-timestamp-toggle-for-easier-clip-sharing/)（取得日2026-07-24。YouTube公式ヘルプページ本文へは直接到達できず、メディア経由の二次情報である点に注意） | 技術ブログ・事例（YouTube公式機能の解説記事） | 中（YouTube公式ヘルプページの一次確認はできていないが、複数の独立した技術メディアが同一の公式機能を報じており事実自体の信頼性は高い） | 動画共有の業界標準は「再生位置をURLクエリ/フラグメントの数値（秒）で運び、コンテンツ本体（動画）はサーバー側に既にある」という設計。共有時に新規リソースを都度生成しない | RQ-12(a)「URLクエリで再生位置・選択艇を運び、注釈本体はDB」はこの業界慣行と同型。`?t=1234&boats=a,b`のような形で現在時刻・選択艇をクエリに載せ、注釈はDBの通常データとして扱う設計はこの慣行の直接適用 | 動画は「単一の時間軸」だが本プロジェクトは複数艇・複数パラメータ（時刻・選択艇・レグ等）を運ぶ必要があり、YouTubeの単純な`t=`より複雑になる。パラメータ設計は自前で行う必要がある | UI（共有機能）、API（該当なし・フロント完結） |
| nuqs（Next.js向けURL状態管理OSSライブラリ） | [github.com/47ng/nuqs](https://github.com/47ng/nuqs)（取得日2026-07-24。starやダウンロード数はWebSearch要約経由の情報で、リポジトリ本体での直接確認はしていない点に注意 — 鮮度懸念小） | OSS | 中（人気度の数値は未検証の伝聞。ライブラリの存在と設計思想自体はGitHub公式リポジトリで確認） | 「`useState`と同じ書き味でURLクエリ文字列と状態を同期する」設計。Next.js App Router向けに型安全なparser/serializerを提供し、複数のクエリパラメータ（本プロジェクトなら時刻・選択艇・レグ等）を個別のuseStateライクなフックとして扱える | RQ-12(a)を実装する際の具体的な手段。Next.js 14 App Router + React 18という本プロジェクトの技術構成に合致し、新技術予算（1枠）を消費するかは要検討だが、素のuseSearchParams+router.replaceの自前実装でも同等のことは可能なため「必須」ではなく「あれば楽になる」位置づけ | 60fps更新される再生時刻をそのままURLに同期すると、ブラウザ履歴operatorやURL書き換えコストが問題になりうる（低頻度同期・シーク確定時のみ同期、等の設計上の配慮が別途必要。これはnuqs自体の責務ではない） | UI（共有機能）、新技術予算（1枠を消費するかの判断はRQ-04のZustand判断と競合する） |

### RQ-12 の所見（推奨まで。決定ではない — 決定は architect）

- 独立ソースの一致状況: 一致 — 「再生位置のような一時的な状態はURLクエリで運び、注釈本体のような永続データはDBに置く」という役割分担で、動画共有の業界慣行（YouTube）とNext.js向けURL状態管理OSS（nuqs）の設計思想が独立に一致 — 打ち切り理由: 独立2ソース一致（RQ自体が「軽く」の指定のため上限5件を待たず打ち切り）
- 反証探索の結果: 「注釈込み共有はDBスナップショット+short URLの方が優れる」という反証記事は今回の調査範囲では見つからなかった（検索語: `short URL snapshot sharing state vs URL query params tradeoff`は未実施 — 軽い調査指定のため反証探索を1回の一般検索に留め、深掘りはしていない。この点は打ち切り基準の「軽く」に従った判断であり、確証度としてはRQ-01/02/04より低いことを明記する）

## 新RQ候補（あれば1行ずつ。売り込み禁止、提案のみ）

- 新RQ候補: MapLibreの代わりに「無地Canvas＋衛星写真1枚を静的背景画像として事前キャッシュする」構成（RQ-02候補(c)寄り）は、タイルサービスの利用規約リスクを完全に回避できる可能性があり、RQ-02のスパイク時に候補(c)の実測を追加する価値があるかもしれない（今回は調査時間の都合で深掘りしていない）

## 打ち切り記録

| RQ | 調査ソース数 | 終了理由 | 取得日 |
|---|---|---|---|
| RQ-01 | 4 | 独立2ソース一致（Canvas優位の構造的理由）＋deck.gl公式・OSS実例の追加確認で十分 | 2026-07-24 |
| RQ-02 | 2 | 独立2ソース（OSM公式・MapTiler公式）一致 | 2026-07-24 |
| RQ-04 | 4 | 独立2ソース一致（Zustand公式Transient Updates＋dev.toブログ群） | 2026-07-24 |
| RQ-12 | 2 | 独立2ソース一致（YouTube慣行＋nuqs OSS）。RQ指定の「軽く」に従い早期打ち切り | 2026-07-24 |
