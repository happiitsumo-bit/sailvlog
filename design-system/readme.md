# sailvlog Design System (v3)

sailvlog v3の新デザインシステム。既存のClaude-paper（書籍風エディトリアル）を全面置き換え、
**「インスタ・macOS・iOSのように誰でも使いやすく、直感的にわかる」** 方向へ統一する。

## 方向性

- タイポ: システムサンセリフスタック（-apple-system, Hiragino Sans, Noto Sans JP…）。外部フォント読み込みなし（CSP対策・オフライン耐性）
- 形: 角丸大きめ（カード16px・ボタン12px・入力10px）、塗りのプライマリボタン、柔らかい多層シャドウ、ヘアラインボーダー
- 色: ライト/ダーク両テーマをトークン完備。ニュートラルはiOS systemGray的階調、アクセントは単一のマリンブルー
- ナビ: モバイル=下部タブバー、PC=シンプルなトップバー。半透明+backdrop-filterのiOS的マテリアル
- アイコン: Lucide由来のインラインSVG（外部読み込みなし）

## 色

| トークン | ライト | ダーク | 用途 |
|---|---|---|---|
| `--color-accent` | `#0a6fd6` | `#3d93ff` | プライマリボタン・リンク・選択状態 |
| `--color-bg-canvas` | `#f2f2f5` | `#000000` | 画面全体の背景 |
| `--color-bg-elevated` | `#ffffff` | `#242426` | カード・シート・ダイアログ |
| `--color-label-primary` | `#1c1c1f` | `#f2f2f7` | 本文テキスト |
| `--color-separator` | `rgba(60,60,67,.29)` | `rgba(84,84,88,.6)` | ヘアラインボーダー |
| `--color-race` / `--color-practice` | `#e0392f` / `#0a6fd6` | `#ff5b52` / `#3d93ff` | セッション種別 |
| `--color-boat-1..4` | 青/赤/橙/緑 | 同系統・高明度 | 艇識別カラー |

ダークモードは**単純な色反転ではない**。canvas/primary/secondary/elevatedの4面を個別に定義し、
アクセント・セマンティックカラーは暗所でも十分な彩度を保つよう明度を上げて再定義している
（iOSダークモードの階調ロジックに準拠）。詳細は `theme.json` を参照。

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

**Q. `@dsCard` コメントは何のため?**
A. Claude Designのカードインデックスが各プレビューHTMLの1行目のコメントを読み、グループ分けに使う。
新規ページを追加する際は必ず `<!-- @dsCard group="..." -->` を1行目に書くこと。
