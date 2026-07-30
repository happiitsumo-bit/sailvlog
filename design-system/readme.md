# sailvlog Design System (v3 / rev.3)

sailvlog v3のデザインシステム。**土台（使いやすさ）は保ったまま、視覚言語をセーリング固有のものへ改訂した。**

rev.2までは「インスタ・macOS・iOSのように誰でも使いやすく」を全面に出していたが、オーナーフィードバック
（「iOSっぽすぎてセーリングアプリに見えない」）を受け、rev.3では**土台は流用しつつ見た目の固有性だけを
Webならではの表現で足す**方向に改訂した。

## 方向性（rev.3）

**残したもの（使いやすさの土台。ここは変えない）**
- タイポ: システムサンセリフスタック（-apple-system, Hiragino Sans, Noto Sans JP…）。外部フォント読み込みなし
- 形: 角丸（カード16px・ボタン12px・入力10px）、塗りのプライマリボタン、柔らかい多層シャドウ、ヘアラインボーダー
- ライト/ダーク両テーマのトークン完備・アクセシビリティ（コントラスト・focus-visible）
- ナビ: モバイル=下部タブバー、PC=シンプルなトップバー。半透明+backdrop-filterのマテリアル
- アイコン: Lucide由来のインラインSVG（外部読み込みなし）

**変えたもの（没個性→セーリングの世界観）。1〜2本の柱に絞り、全部盛りにしていない**

| 柱 | 何をしたか | どこに出るか |
|---|---|---|
| **1. 海図（nautical chart）** | 緯度経度グリッド・等深線（同心の輪）・コンパスローズを、構造を「読む」ための視覚言語として導入 | ヒーロー帯背景（`.ds-hero-water::before`）・リプレイ海面（`.ds-chart-surface`）・空状態の装飾 |
| **2. 水面と光** | 深い海のグラデーション（夜明けのレガッタ／深夜の海）をヒーロー帯とリプレイ画面に固定採用。テーマ切替に非連動（海はライト/ダークUIの都合で色を変えない） | `--gradient-water-dawn`（一覧・アップロードのヒーロー帯）／`--gradient-water-deep`（リプレイのCanvas面） |

**見送ったもの（意図的な取捨。全部盛りにしない判断）**
- 風向・風速の本格的なアイコン体系（風矢羽・吹き流し）→ `.ds-chip--wind` に12pxアイコン枠だけ用意し、実装は次rev以降
- 国際信号旗の抽象化 → 今回は着手せず。艇識別カラー(`--color-boat-*`)で代替できているため優先度を下げた
- 禁止事項として厳守: 錨マークの乱発（ブランドマークとして1箇所のみ）・ロープ枠・木目などのテーマパーク的キッチュ

**背景の低速アニメーション**（グリッド・等深線がごくゆっくり流れる=`.ds-chart-drift`, 90s linear infinite）は
`prefers-reduced-motion: reduce`で完全停止し、静止画としても成立するデザインにしている。

## 色

| トークン | ライト | ダーク | 用途 |
|---|---|---|---|
| `--color-accent` | `#0b6a9e` | `#2f9fd1` | プライマリボタン・リンク・選択状態 |
| `--color-bg-canvas` | `#f2f2f5` | `#000000` | 画面全体の背景 |
| `--color-bg-elevated` | `#ffffff` | `#242426` | カード・シート・ダイアログ |
| `--color-label-primary` | `#1c1c1f` | `#f2f2f7` | 本文テキスト |
| `--color-separator` | `rgba(60,60,67,.29)` | `rgba(84,84,88,.6)` | ヘアラインボーダー |
| `--color-race` / `--color-practice` | `#e0392f` / `#0b6a9e` | `#ff5b52` / `#2f9fd1` | セッション種別 |
| `--color-boat-1..4` | 青/赤/橙/緑 | 同系統・高明度 | 艇識別カラー |

ダークモードは**単純な色反転ではない**。canvas/primary/secondary/elevatedの4面を個別に定義し、
アクセント・セマンティックカラーは暗所でも十分な彩度を保つよう明度を上げて再定義している
（iOSダークモードの階調ロジックに準拠）。詳細は `theme.json` を参照。

rev.3でアクセントを汎用iOSブルー(`#0a6fd6`/`#3d93ff`)からやや青緑寄りの「マリンチャート」トーンへ
僅かにシフトした（`practice`・`info`・`boat-1`・`wind-chip-fg`も連動）。white-on-accentのコントラスト比は
light ≈5.9:1・dark ≈3.0:1（旧トークンのdarkは≈3.1:1）で、既存水準を落としていない。

### 海図 / 水面と光（rev.3新規）

| トークン | 用途 |
|---|---|
| `--color-chart-grid` / `--color-chart-line` / `--color-compass-ink` | 海図グリッド・等深線・コンパスローズのインク。ライト/ダークで濃淡を再定義 |
| `--gradient-water-dawn` / `--gradient-water-deep` | ヒーロー帯・リプレイ海面用の固定グラデーション（テーマに非連動、`:root`一箇所のみ定義） |
| `--color-chart-grid-on-water` / `--color-chart-line-on-water` | 上記グラデーション上のグリッド・等深線（常に白系半透明） |
| `--color-hero-label-primary` / `--color-hero-label-secondary` | ヒーロー帯上のテキスト色（常に明色。ページのライト/ダークに関係なく海は暗いという前提） |

対応する部品クラス: `.ds-hero-water`（ヒーロー帯）・`.ds-hero-water--deep`（濃い水面バリエーション）・
`.ds-chart-surface`（常時ダークな海図面。リプレイCanvasの下敷き）・`.ds-compass-rose`（装飾コンパス。1画面1箇所まで）。
背景の等深線/グリッドは`.ds-chart-drift`（90s linear infinite）でごく低速に流れるが、
`prefers-reduced-motion: reduce`で完全停止する。

## タイプスケール

iOSのLarge Title的階層（large-title 34/41 bold 〜 caption2 11/13）。`styles.css` の `.ds-text-*` クラスと
`--font-size-*` / `--line-height-*` トークンを参照。

## 角丸・影・スペーシング

- 角丸: `--radius-sm(8) / input(10) / button(12) / card(16) / sheet(20) / pill(999)`
- 影: `--shadow-xs/sm/md/lg/float`（多層・柔らかい浮遊感。ダークは黒の透明度で表現）
- スペーシング: 8ptグリッド `--space-xs(4) 〜 --space-6xl(64)`

## コンポーネント一覧

| ファイル | 内容 |
|---|---|
| `foundations/type.html` | タイプスケール・ウェイト |
| `foundations/color.html` | カラートークン一覧（アクセント/ニュートラル/サーフェス/セマンティック/sailvlog固有） |
| `foundations/layout.html` | スペーシング・角丸・影のスケール |
| `foundations/icons.html` | Lucide由来アイコンサンプル |
| `components/buttons.html` | primary/secondary/tertiary/destructive、サイズ、状態、アイコンボタン |
| `components/forms.html` | 入力・テキストエリア・トグル・チェック/ラジオ・セグメント・チップ |
| `components/cards.html` | 基本カード・セッションカード・グループ化リスト |
| `components/navigation.html` | モバイル下部タブバー / PCトップバー |
| `components/dialog.html` | 確認ダイアログ・ボトムシート |
| `components/table.html` | レグ別タイム比較・セッション履歴テーブル |
| `components/sailvlog.html` | セッションカード・再生バー・タイムライン注釈ピン・レグジャンプ・2艇比較・艇レジェンド・リプレイ画面実装例 |

## Do / Don't

**Do**
- 色・角丸・影・スペーシングは必ず `var(--color-*)` / `var(--radius-*)` / `var(--shadow-*)` / `var(--space-*)` を参照する
- プライマリアクションは1画面に1つ（`ds-btn--primary`は目立たせたい主動線のみ）
- ダークモードは `prefers-color-scheme` に任せ、プレビューでの検証にのみ `data-theme` 属性を使う
- 日本語UIテキストは実際のsailvlog文脈（艇番号・風速・セッション種別）で書く

**Don't**
- 生の hex / px をコンポーネントCSSに直書きしない（トークン外の値は新しいトークンとして追加してから使う）
- 塗りのボタンを1画面に何個も並べない（強調が薄れる）
- リプレイ画面のような「常時ダーク」を意図する画面以外で、ダークトークンを固定で埋め込まない
- 外部フォント・外部アイコンフォントを読み込まない（CSP違反・オフライン時に壊れる）
- 錨マーク・ロープ枠・木目などのテーマパーク的キッチュを追加しない（ブランドマークとしての錨1箇所のみ許容）
- `.ds-hero-water` / `.ds-compass-rose` を1画面に何箇所も置かない（海図モチーフは背景に徹する。主役はデータ）
- `.ds-chart-drift` のアニメーションを`prefers-reduced-motion`のガードなしで新しい要素に追加しない

## ファイル構成

```
design-system/
├── styles.css              唯一のスタイルシート（トークン + コンポーネント層）
├── theme.json               トークンの機械可読記録
├── readme.md                 このファイル
├── thumbnail.html            カバー（ブランドマーク+スウォッチ）
├── foundations/
│   ├── type.html
│   ├── color.html
│   ├── layout.html
│   └── icons.html
└── components/
    ├── buttons.html
    ├── forms.html
    ├── cards.html
    ├── navigation.html
    ├── dialog.html
    ├── table.html
    └── sailvlog.html          sailvlog固有コンポーネント + リプレイ画面実装例
```

## Q&A / トラブルシューティング

**Q. トークンを変えたら全ページに反映される?**
A. 反映される。全プレビューは `../styles.css` を1つだけlinkしているため、`:root` / `[data-theme="dark"]` の値を
`styles.css` で変更すれば全ページに波及する。theme.jsonは記録用の複製なので、値を変えたら両方揃えること。

**Q. ライト/ダークの見た目はどこで確認する?**
A. 各プレビュー右上の「Auto / Dark / Light」ボタンで `<html data-theme>` を切り替えられる。Autoの状態では
OS設定（`prefers-color-scheme`）に従う。

**Q. なぜリプレイ画面だけダークが固定?**
A. sailvlogのリプレイは反省会でのプロジェクタ投影を想定しており、周囲の照度に関わらず視認性を保つため
意図的に常時ダークにしている（`docs/dev-org/mockups/replay.html` の設計判断を踏襲）。トークン自体はライト/ダーク
共通の `styles.css` から取得しており、別の色定義を持たせているわけではない。

**Q. アイコンを追加したい**
A. Lucideの公式SVGパスをそのまま `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
stroke-linecap="round" stroke-linejoin="round"` の枠にコピーする。CDN読み込みは禁止（CSP対策）。

**Q. `--gradient-water-*` はなぜライト/ダークで値が分かれていない?**
A. 意図的。「海はUIのテーマ設定に関係なく常に深い」という前提を採用し、`:root`に1回だけ固定定義している
（リプレイ画面が常時ダークなのと同じ設計判断を、ヒーロー帯にも拡張した形）。ページ全体がライトテーマでも
ヒーロー帯の中だけは常に暗い水の上に明色テキスト（`--color-hero-label-*`）が乗る。

**Q. `.ds-chart-drift`のアニメーションは常時動いていて重くない?**
A. `background-position`の`transform`アニメーションのみでCanvas再描画は発生しない（GPU合成で軽量）。
またOS側で「視差効果を減らす」等が有効な場合（`prefers-reduced-motion: reduce`）は完全停止し、
静止した海図として表示される。実装時にDevToolsのレンダリング設定で有効化して確認できる。

**Q. 海図モチーフ（グリッド・等深線・コンパスローズ）はどこまで使っていい?**
A. 背景装飾専用。データや文字の上に重ねて可読性を落とす使い方はしない。`.ds-hero-water`と
`.ds-chart-surface`はどちらも`position:relative`+`z-index:1`で中身のコンテンツを装飾より前面に出す構造に
なっているため、新しい画面に組み込む際もこの構造（子要素はデフォルトで前面）を崩さないこと。

**Q. `@dsCard` コメントは何のため?**
A. Claude Designのカードインデックスが各プレビューHTMLの1行目のコメントを読み、グループ分けに使う。
新規ページを追加する際は必ず `<!-- @dsCard group="..." -->` を1行目に書くこと。
