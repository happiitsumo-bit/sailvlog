# sailvlog UI デザイン改善提案書

> 作成: research-agent（UI/UX専門）  
> 対象バージョン: Next.js 14 + TypeScript  
> 対象ブランチ: main（コードスナップショット 2025-05-19）

---

## 1. 現状診断（ページごと）

### 1.1 globals.css（デザインシステム）

**強み**
- デザイントークンが一貫しており、カラーパレット（テラコッタ・セージ・ディジョン）はセーリングの「海・大地・陽光」に対応している
- `--ease-out`・`--ease-snap` などアニメーション曲線をトークン化している点は堅牢

**問題点**
1. **セーリング固有の視覚語彙がゼロ** — 波形・風向き・ロープ・艇シルエットを表現するCSSクラスが一切ない。現状は「落ち着いたブログデザイン」であり、セーリングである必然性が見えない
2. **Legacy alias が残骸化** — `--ink`/`--bone`/`--flare`/`--cyan`/`--lime` といった旧エイリアスが本体変数と混在し、次の開発者が混乱するリスクがある。実際の使用箇所はほぼないため削除候補
3. **`--shadow-flare`・`--shadow-cyan` が `var(--shadow)` の丸投げ** — アクセントに連動したシャドウが作れていない
4. **波形・水平区切り線がない** — セクション区切りが全て `border-top: 1px solid var(--border)` の直線のみ。海洋感がない
5. **モバイルでの `padding-top` が `3rem` から `1.75rem` に縮まるが、ボトムは `5rem`→`3rem`** — タブレット(980px)帯のコンテナ余白が未調整のまま

### 1.2 トップページ（page.tsx）

**問題点**
1. **ヒーローの統計が「表示件数」を表示している** — `articles.length`・`trendingQuestions.length`・`recentPosts.length` はそれぞれ「APIから取得した件数上限（5・3・3）」を返している。コミュニティ規模を伝えるはずのメトリクスが最大でも `5` しか表示されず信頼性を損なう。総件数を別途取得するか、`total` フィールドを使うべき
2. **ヒーロー文言が英語と日本語が混在** — "A technical exchange where the wind reads you" の後に日本語サブテキストが来る構造は問題ないが、ヒーロー左上の `"Northwest · 14kt · SE"` が静的文字列であり、本物の気象データではない。「飾り」だと一目でわかる場合はよいが、嘘情報と誤認されるリスクがある
3. **サイドバーの「Yachts」リストに件数がない** — Qiitaのタグサイドバーと比べ情報密度が低い
4. **サイドバーの「Explore」が単なるナビゲーションの複製** — Navbarにすでに同じリンクがある。サイドバーには「今週のアクティブセーラー」「急上昇タグ」など文脈固有の情報を置くべき
5. **「Live Feed」セクションの投稿アクションが `♥ {n}` のみ** — Likeボタンが `<span>` で実装されておりクリック不可（トップページは読み取り専用なので許容可だが、UIとして不誠実）
6. **セクション間の間隔** — 「Latest Articles」→「Trending Questions」→「Live Feed」の3セクションが `marginTop: "3rem"` のインラインスタイルで区切られている。グローバルCSSのトークンを使うべき

### 1.3 Navbarコンポーネント

**問題点**
1. **2段構成（上: ブランド+ナビ、下: 艇種クラス）が常時表示** — 合計 64px + 48px = 112px をスクロールなしに常に消費。モバイルでは特に圧迫感がある
2. **艇種クラスの下段ナビ（`navbar-row-bottom`）がモバイルで非表示かどうか不明** — CSSの `.navbar-links` と `.navbar-actions` はモバイルで `display: none` だが、`navbar-row-bottom` はモバイルでも表示されたままになっている。スクロールできるがUSBが消えるのと同じで使いにくい
3. **`navbar-brand` の `dot` が単なる橙丸** — 風向きコンパスや帆のアイコンに変えるだけでブランドが差別化される
4. **アクティブ状態の表現がbg変化だけ** — 下線・ボーダー左などセーリングらしい強調がない
5. **`CLASS_LINKS` がハードコード** — 艇種はAPIから取得した `boatTypes` と二重管理になっている可能性がある

### 1.4 ArticleCardコンポーネント

**問題点**
1. **本文のプレビューがない** — カードにタイトル・タグ・作者のみで、記事の中身が何も見えない。ユーザーがクリックするか否かを判断するための情報が不足
2. **`BADGE_VARIANTS` が `article.id % 3` で色が決まる** — 「470は常にテラコッタ、ILCAはセージ」のように艇種で色をマッピングすれば意味ある色使いになる
3. **`♥ ◐ ◉` という記号が説明なし** — 初見ユーザーには likes / comments / views の区別がつかない。ツールチップかラベルを添えるべき
4. **`article-card:hover` で `-3px` の垂直移動** — ソフトシャドウとの組み合わせは上品だが、カード内のリンク（タグ・著者）をホバーするとカード全体が浮き上がるため、子要素のリンクがクリックしにくくなるケースがある
5. **記事にサムネイル画像のスロットがない** — レースレポートや艇の写真を使った視覚的なカードに発展できるフック（`coverImage` フィールドがあれば）がない

### 1.5 Articlesページ

**問題点**
1. **フィルターバー（filter-bar）が横スクロール前提** — 艇種が多い場合、`border-radius: 999px` の丸型バーが崩れる可能性がある（モバイルで `border-radius: var(--radius-lg)` に切り替えているが、視認性が落ちる）
2. **サイドバーの「By Yacht」と「Tags」がフィルターバーと二重** — フィルターバーで艇種を絞り込めるのにサイドバーでも同じ操作ができ、動線が分散している
3. **ページネーションがシンプルすぎる** — 現在ページと総ページ数しか表示されない。記事が多い場合、何ページ目に何がある気がしない

### 1.6 Q&Aページ

**問題点**
1. **`question-card` の左カラムが数値のみ** — `96px` の幅を3つの数値（Ans/Votes/Views）で分け合っており、文字サイズが小さい。Stack Overflowの解決済みチェックマーク付きバッジのように、解決状態を視覚的に強調するデザインが弱い
2. **艇種フィルターがナビ下段（CLASS_LINKS）とサイドバーと両方にある** — ユーザーはどこを使えばいいか迷う
3. **質問文の抜粋が120文字** — タイトルが長い質問では本文がほぼ見えないケースがある

### 1.7 Feedページ

**問題点**
1. **サイドバーがほぼ空** — `Stats` モジュールに「{total} posts total」の1行のみ。フィード特有の文脈情報（アクティブユーザー・今日の投稿数・ハッシュタグ）が何もない
2. **投稿フォームの `placeholder` が長い** — 「今日の気付きを共有 — 風向き、セッティング、練習のメモ...」は良い誘導だが、Composerのスタイルが記事の `form-group` と揃っておらず違和感がある
3. **ハッシュタグ機能がない** — セーリングの投稿には `#上マーク` `#ジャイブ` `#470全日本` のようなハッシュタグが自然に馴染むが、UIに導線がない
4. **投稿の「いいね」ボタンが `♥` の絵文字のみ** — ログイン済みか否かによらず同じ見た目で、状態がわからない

### 1.8 Learnページ

**問題点**
1. **コースカードに視覚的な差別化がない** — BEGINNER・INTERMEDIATE・ADVANCED が文字ラベルだけで、色・アイコン・バーによる難易度表現がない
2. **`accentColor` が `--accent` CSS変数に渡されているが使われていない** — `course-card` のスタイルに `var(--accent)` の参照がなく、データが死んでいる
3. **`estimatedHours` が `{c.estimatedHours}h` と表示されるが `undefined` の場合の処理がない**
4. **コース一覧がフラットなグリッド** — セーリングのレベルは「沿岸レース初心者 → インショア戦術 → オフショア」のように段階的な旅程があるはずだが、それが見えない

### 1.9 Sailorsページ

**問題点**
1. **検索入力が `.composer` スタイルを流用しているが、`composer` は投稿フォームのクラス** — 意味的に誤用であり、今後のリファクタリング時に混乱する
2. **ユーザーアバターが文字1文字のみ** — セーリングコミュニティ感を出すには、艇種バッジやクラブ旗のような視覚的な所属表示が欲しい
3. **`s.experienceYears` が `{n}y` と表示されるが、単位が「年」だとわかりにくい**
4. **検索がリアルタイム（useEffect + fetch）だがデバウンスがない** — キーストロークごとにAPIを叩く実装になっている

---

## 2. セーリング固有のデザイン言語提案

### 2.1 風向きインジケーター（Wind Rose Badge）

ナビバーのロゴ横や、ヒーローセクションの `hero-corner` に適用する。CSSのみで実装可能。

```css
/* 16方位の「北」マーカー付き風向きコンパス */
.wind-rose {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  background: var(--card);
}

/* 風向き矢印 — JS で --wind-angle を書き換えるだけで向きが変わる */
.wind-rose::after {
  content: "";
  position: absolute;
  top: 50%; left: 50%;
  width: 2px;
  height: 12px;
  background: var(--terra);
  transform-origin: bottom center;
  transform: translateX(-50%) translateY(-100%)
             rotate(var(--wind-angle, 225deg));
  border-radius: 1px;
}

/* 中心点 */
.wind-rose::before {
  content: "";
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 5px; height: 5px;
  background: var(--fg);
  border-radius: 50%;
}
```

使い方（React）:
```tsx
<div className="wind-rose" style={{ '--wind-angle': '135deg' } as React.CSSProperties} />
```

---

### 2.2 波形セクション区切り線（Wave Divider）

セクションの下端に置くSVGベースのCSSで、「紙の上に波が来る」質感を出す。`section-divider` クラスとして追加する。

```css
.wave-divider {
  position: relative;
  height: 32px;
  overflow: hidden;
  margin: 2rem 0;
}

.wave-divider::before {
  content: "";
  position: absolute;
  bottom: 0;
  left: -10%;
  width: 120%;
  height: 100%;
  background: var(--paper-2);
  /* SVG波形をbase64エンコードして埋め込む */
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 32'%3E%3Cpath d='M0 16 C200 0 400 32 600 16 C800 0 1000 32 1200 16 L1200 32 L0 32 Z' fill='black'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 32'%3E%3Cpath d='M0 16 C200 0 400 32 600 16 C800 0 1000 32 1200 16 L1200 32 L0 32 Z' fill='black'/%3E%3C/svg%3E");
  mask-size: 100% 100%;
}
```

---

### 2.3 艇種カラーコーディング（Class Color System）

現在 `BADGE_VARIANTS` が `id % 3` でランダム色を決めているが、艇種別に固定カラーを割り当てる。これにより視覚的な記憶性が生まれ「テラコッタ = 470」と素早く認識できる。

```css
/* globals.css に追加 */
:root {
  --class-470:     #C96442;  /* テラコッタ — 日本の470は歴史が長くフラッグシップ */
  --class-ilca:    #6B8E5A;  /* セージ — ILCAはシングルハンダー、自然・個人 */
  --class-snipe:   #C39A3F;  /* ディジョン — スナイプは知的・温かみ */
  --class-49er:    #4A7CB5;  /* ネイビー — 49erはスピード・先進 */
  --class-cruiser: #7B6B5A;  /* ウォームグレー — クルーザーは重厚 */
  --class-other:   #9A968C;  /* ニュートラル */
}

.boat-badge[data-class="470"]     { background: rgba(201,100,66,0.10); color: var(--class-470); border-color: rgba(201,100,66,0.30); }
.boat-badge[data-class="ilca"]    { background: rgba(107,142,90,0.10); color: var(--class-ilca); border-color: rgba(107,142,90,0.30); }
.boat-badge[data-class="snipe"]   { background: rgba(195,154,63,0.10); color: var(--class-snipe); border-color: rgba(195,154,63,0.30); }
.boat-badge[data-class="49er"]    { background: rgba(74,124,181,0.10); color: var(--class-49er); border-color: rgba(74,124,181,0.30); }
.boat-badge[data-class="cruiser"] { background: rgba(123,107,90,0.10); color: var(--class-cruiser); border-color: rgba(123,107,90,0.30); }
```

ArticleCard.tsx の修正点:
```tsx
// Before
<span className={`boat-badge ${badgeVariant}`}>

// After — slugをdata属性とクラスの両方に持たせる
<span className="boat-badge" data-class={article.boatType.slug}>
```

---

### 2.4 ロープノット区切り線（Rope Rule）

記事カードのフッター区切りや、サイドバーのセクション見出し下に使う。CSSのグラデーションで麻縄のテクスチャを模倣する。

```css
.rope-rule {
  border: none;
  height: 3px;
  background:
    repeating-linear-gradient(
      90deg,
      var(--fg-dim) 0px,
      var(--fg-dim) 2px,
      transparent 2px,
      transparent 6px,
      var(--fg-mute) 6px,
      var(--fg-mute) 8px,
      transparent 8px,
      transparent 12px
    );
  opacity: 0.3;
  margin: 1.25rem 0;
  border-radius: 2px;
}
```

---

### 2.5 帆走角インジケーター（Sailing Angle Pill）

記事・投稿に「風向との角度」タグを付けられるようにする。視覚的には半円のclip-pathで帆の角度を表現する。

```css
/* 艇が風上・クローズ・ビーム・ランニングのどの角度かを示すバッジ */
.angle-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--fg-mute);
  background: var(--card);
}

/* 帆シルエット（CSSのみ） */
.angle-badge::before {
  content: "";
  display: inline-block;
  width: 8px;
  height: 12px;
  background: var(--terra);
  clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
  transform: rotate(var(--sail-angle, 15deg));
  opacity: 0.7;
}
```

---

### 2.6 ナビブランドのコンパスドット改良

現在の `.dot`（8px 橙丸）をコンパスローズアイコンに変える。SVGを直接コンポーネント内に埋め込む形が最もシンプル。

```tsx
// Navbar.tsx — ブランドマーク部分を差し替え
<Link href="/" className="navbar-brand">
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    {/* 外円 */}
    <circle cx="10" cy="10" r="9" stroke="var(--terra)" strokeWidth="1.5" fill="none"/>
    {/* 北向きポインター */}
    <path d="M10 2 L12 10 L10 8 L8 10 Z" fill="var(--terra)"/>
    {/* 南向きポインター */}
    <path d="M10 18 L12 10 L10 12 L8 10 Z" fill="var(--fg-dim)"/>
  </svg>
  sailvlog
</Link>
```

---

### 2.7 水平線グラデーション（Horizon Hero Background）

ヒーローセクションの背景に「水平線」を連想させるグラデーションを加える。現在は単純な `var(--paper)` + radial-gradientだが、下部に濃い帯を入れると海の境界線に見える。

```css
.hero {
  /* 既存プロパティを維持したまま追加 */
  background:
    /* 水平線ライン */
    linear-gradient(
      to bottom,
      transparent 60%,
      rgba(107,142,90,0.06) 75%,    /* 海面の色み */
      rgba(107,142,90,0.12) 100%
    ),
    /* 既存の光源グラデーション */
    radial-gradient(circle at 20% 30%, rgba(201,100,66,0.06), transparent 55%),
    radial-gradient(circle at 80% 80%, rgba(195,154,63,0.05), transparent 55%),
    var(--paper);
}
```

---

## 3. ページ別 改善仕様

### 3.1 トップページ

#### Hero セクション

| 要素 | 現状 | 変更仕様 |
|------|------|---------|
| `hero-corner` | `"Northwest · 14kt · SE"` 静的文字列 | `className="hero-corner"` に `data-live="true"` 属性を追加し、モノトーンの「Wind データ表示中」インジケーターであることを視覚的に示す。将来の気象API連携のための `id="wind-badge"` を付与 |
| ヒーロー統計 | `articles.length`（最大5） | `getArticles()` に `total` を含む別エンドポイント(`/api/stats`)を呼ぶか、`total` を `getArticles` が返す値から使う。表示は `"articles.length > 0 ? total : '—'"` に変更 |
| 背景 | 単純 paper + radial | 2.7の水平線グラデーションを適用 |
| `hero-eyebrow::before` | 24px の直線 | `wind-rose` コンポーネントに差し替え（2.1参照） |

#### メインコンテンツ列

```tsx
// セクションヘッドのmarginTopをインラインスタイルから外す
// Before
<div className="section-head" style={{ marginTop: "3rem" }}>

// After — globals.cssの .section-head に marginTop: 3rem が既にある
<div className="section-head">
```

#### サイドバー

- 「Yachts」リスト: 各 `<li>` に投稿数カウントを `className="count"` で追加
- 「Explore」リストを削除し、代わりに「今週のアクティブセーラー TOP3」モジュールを配置
- APIが未対応の場合は静的プレースホルダーで構造だけ先に作る

---

### 3.2 Navbar

#### 構造変更

```
現状:
  [row-top]   ブランド | Feed Q&A Learn Sailors | Login Join
  [row-bottom] Class | 470 ILCA Snipe 49er Cruiser Other

提案:
  [row-top]   コンパスブランド | Feed Q&A Learn Sailors | Wind Badge | Login Join
  [row-bottom] 470 ILCA Snipe 49er Cruiser Other  ← "Class" ラベルを削除、各リンクに艇種カラードット追加
```

#### CSS変更

```css
/* navbar-row-bottom の "Class" テキストラベルを廃止 */
/* 代わりに各クラスリンクにカラードットを付ける */
.navbar-class-link::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--class-color, var(--fg-dim)); /* data属性でCSS変数を切り替え */
  flex-shrink: 0;
}

/* アクティブ時の強調を下線ボーダーに変更 */
.navbar-class-link.active {
  background: transparent;
  border-bottom: 2px solid var(--class-color, var(--terra));
  border-radius: 0;
  color: var(--fg);
}
```

#### モバイル対応

```css
/* row-bottom をモバイルでは横スクロールのみ（現状のまま）だが、高さを 40px に削減 */
@media (max-width: 768px) {
  .navbar-row-bottom {
    height: 40px;
  }
}
```

---

### 3.3 ArticleCard

#### 本文プレビューの追加

型定義に `summary?: string` または `body` の冒頭120文字をコンポーネント側でスライスして表示する。

```tsx
// ArticleCard.tsx に追加
{article.summary && (
  <p className="article-card-excerpt">{article.summary}</p>
)}
```

```css
/* globals.css に追加 */
.article-card-excerpt {
  font-size: 0.88rem;
  color: var(--fg-mute);
  line-height: 1.6;
  margin-bottom: 0.85rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

#### 艇種バッジの色修正

```tsx
// BADGE_VARIANTS を廃止し、slug ベースの data-class 属性に変更
<span className="boat-badge" data-class={article.boatType.slug}>
  {article.boatType.name}
</span>
```

#### 統計アイコンの改善

```tsx
// Before
<span>♥ {article._count.likes}</span>
<span>◐ {article._count.comments}</span>
<span>◉ {article.viewCount}</span>

// After — aria-label でスクリーンリーダー対応、タイトル属性でツールチップ
<span title="いいね" aria-label={`${article._count.likes}いいね`}>♥ {article._count.likes}</span>
<span title="コメント" aria-label={`${article._count.comments}コメント`}>💬 {article._count.comments}</span>
<span title="閲覧数" aria-label={`${article.viewCount}閲覧`}>👁 {article.viewCount}</span>
```

---

### 3.4 Articlesページ

#### フィルターバーの改善

艇種バッジに艇種カラードットを追加（2.3参照）。現状の丸型バーがモバイルで崩れる問題を、フィルターを `filter-bar` から外して独立した `<nav>` に変更することで解決。

```tsx
// フィルターとアクションボタンを分離
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", gap: "1rem" }}>
  <nav className="filter-bar" style={{ flex: 1, borderRadius: "var(--radius-lg)" }}>
    {/* 艇種チップ */}
  </nav>
  <Link href="/articles/new" className="btn btn-primary">+ Write</Link>
</div>
```

---

### 3.5 Q&Aページ

#### question-card の視覚改善

```css
/* globals.css — 解決済み質問の左ボーダーをセージに */
.question-card.solved {
  border-left: 3px solid var(--sage);
}

/* メトリクスカラムの幅を 96px → 80px に縮小し、本文エリアを広げる */
.question-card {
  grid-template-columns: 80px 1fr;
}
```

```tsx
// 解決済みは class を追加
<Link className={`question-card ${hasAccepted ? "solved" : ""}`} ...>
```

#### サイドバーへの「質問のコツ」追加

```tsx
<div className="module">
  <h3 className="sidebar-title">質問のコツ</h3>
  <ul style={{ fontSize: "0.82rem", color: "var(--fg-mute)", lineHeight: 1.7, paddingLeft: "1.2rem" }}>
    <li>艇種を明記する</li>
    <li>風速・海面コンディションを書く</li>
    <li>試したことをリストアップする</li>
  </ul>
</div>
```

---

### 3.6 Feedページ

#### サイドバーの充実

```tsx
// 現状の "Stats" モジュールを拡張
<div className="module">
  <h3 className="sidebar-title">Today's Fleet</h3>
  <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--fg-mute)" }}>
    <span className="live-dot" />  {total} posts total
  </p>
  {/* 将来: アクティブセーラーのアバターリスト */}
</div>

<div className="module">
  <h3 className="sidebar-title">Post Tips</h3>
  <p style={{ fontSize: "0.82rem", color: "var(--fg-mute)", lineHeight: 1.65 }}>
    風向き・艇種・場所を添えると仲間に伝わりやすい。
  </p>
</div>
```

#### Composerのデバウンス（文字カウンターの色変化）

現状は `draft.length > max - 30` でテラコッタに変わるが、`max - 50` から黄色（ディジョン）→ `max - 20` からテラコッタという2段階にする。

```tsx
const counterColor =
  draft.length > max - 20 ? "var(--terra)" :
  draft.length > max - 50 ? "var(--dijon)" :
  undefined;
```

---

### 3.7 Learnページ

#### コースカードへの難易度バー

```css
/* globals.css に追加 */
.course-difficulty-bar {
  display: flex;
  gap: 3px;
  margin-bottom: 1rem;
}
.course-difficulty-pip {
  width: 18px;
  height: 4px;
  border-radius: 2px;
  background: var(--border-strong);
}
.course-difficulty-pip.filled {
  background: var(--terra);
}
/* INTERMEDIATE: 2つ目まで。ADVANCED: 3つ全部 */
```

```tsx
// コースカード内に追加
const difficultyLevel = c.level === "BEGINNER" ? 1 : c.level === "INTERMEDIATE" ? 2 : 3;
<div className="course-difficulty-bar">
  {[1,2,3].map((n) => (
    <div key={n} className={`course-difficulty-pip ${n <= difficultyLevel ? "filled" : ""}`} />
  ))}
</div>
```

#### `accentColor` の活用

```css
/* course-card の上端にアクセントカラーのボーダーを追加 */
.course-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--accent, var(--terra));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
```

---

### 3.8 Sailorsページ

#### 検索フォームのクラス修正

```tsx
// .composer ではなく専用クラスを使う
<div className="search-box">
  <input ... />
</div>
```

```css
/* globals.css に追加 */
.search-box {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 0.85rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  transition: border-color 0.18s var(--ease-out);
}
.search-box:focus-within {
  border-color: var(--terra);
  box-shadow: 0 0 0 3px rgba(201,100,66,0.08);
}
.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--fg);
  font-family: var(--font-body);
  font-size: 0.95rem;
}
/* 検索アイコン（SVG） */
.search-box::before {
  content: "⌕";
  font-size: 1.1rem;
  color: var(--fg-dim);
  flex-shrink: 0;
}
```

#### フィルターバーへの艇種カラードット

```tsx
// 各 filter-chip に data-class を追加して艇種カラーを適用
<button
  key={bt.slug}
  data-class={bt.slug}
  className={`filter-chip ${boat === bt.slug ? "active" : ""}`}
  onClick={() => setBoat(bt.slug)}
>
  {bt.name}
</button>
```

#### 検索デバウンス

```tsx
// useMemo を使った検索クエリのデバウンス（300ms）
import { useMemo, useEffect, useRef } from "react";

const [debouncedQuery, setDebouncedQuery] = useState("");
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

function handleQueryChange(value: string) {
  setQuery(value);
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => setDebouncedQuery(value), 300);
}

// useEffect の依存配列を [debouncedQuery, boat] に変更
```

---

## 4. 優先度マトリクス

インパクト（ユーザー体験への影響）とコスト（実装工数）で評価。★が多いほど優先度が高い。

| 優先度 | 施策 | インパクト | コスト | 対象ファイル |
|--------|------|-----------|--------|-------------|
| ★★★ | **ArticleCard に本文プレビューを追加** | コンテンツの中身が見えず離脱が多い問題を直撃 | 低（型定義 + CSS 2行） | `ArticleCard.tsx`, `globals.css` |
| ★★★ | **艇種カラーコーディングの適用** | 「470 = テラコッタ」という色の記憶が生まれ、Qiitaとの差別化に直結 | 低（CSS変数 + data属性） | `globals.css`, `ArticleCard.tsx`, `Navbar.tsx` |
| ★★★ | **ヒーロー統計の修正（件数上限問題）** | 「3記事」と表示されるのはコミュニティの信頼性を損なう致命的な問題 | 中（APIエンドポイント調整） | `page.tsx`, `API` |
| ★★☆ | **wave-divider のセクション区切り適用** | 視覚的にセーリングらしさが増す最も手軽なオリジナリティ追加 | 低（CSS + JSX 1行） | `globals.css`, `page.tsx` |
| ★★☆ | **ナビのコンパスブランドアイコン** | ロゴは常に表示され全ページに影響する。ブランド認知の核 | 低（SVGインライン） | `Navbar.tsx` |
| ★★☆ | **Feedサイドバーの充実** | 現状「{n} posts total」のみで最も情報が薄い | 低（JSX追加のみ） | `feed/page.tsx` |
| ★★☆ | **Q&Aの解決済みカード左ボーダー** | 解決率が高いコミュニティに見せる最小コストの改善 | 低（CSS + class追加） | `globals.css`, `questions/page.tsx` |
| ★★☆ | **LearnページのaccentColor活用と難易度バー** | データが死んでおり、コース一覧のスキャナビリティが低い | 低（CSS + JSX） | `globals.css`, `learn/page.tsx` |
| ★☆☆ | **風向きインジケーター（Wind Rose）** | セーリングらしさの象徴だが、データなしだと飾りになる | 中（CSS実装は簡単だが意味ある使い方に工夫が必要） | `globals.css`, `Navbar.tsx` |
| ★☆☆ | **Sailorsページの検索デバウンス** | UXの細部改善。現状もそれほど問題にはなっていない | 低（useRef + setTimeout） | `sailors/page.tsx` |
| ★☆☆ | **Legacy CSSエイリアスの整理** | 技術的負債だが即座のUX改善にはならない | 中（全ファイルの参照確認が必要） | `globals.css` |
| ★☆☆ | **ロープノット区切り線** | 視覚的な遊び心はあるが、過剰装飾になるリスク | 低（CSS追加） | `globals.css` |

### 実装推奨順序

```
Week 1 (クイックウィン):
  1. 艇種カラーコーディング（globals.css + ArticleCard.tsx）
  2. ArticleCard本文プレビュー
  3. wave-divider のセクション区切り
  4. Q&A解決済みカードの左ボーダー

Week 2 (コア改善):
  5. ヒーロー統計の修正
  6. ナビのコンパスブランドアイコン
  7. Feedサイドバーの充実
  8. LearnページのaccentColor活用

Week 3 (ポリッシュ):
  9. 風向きインジケーター（APIデータと連携できるなら）
  10. Sailorsページのデバウンス + search-boxクラス分離
  11. Learnの難易度バー
```

---

*この提案書はコード実装前のリサーチ・仕様定義フェーズの成果物です。各施策の詳細な実装はdesign-implチームが担当します。*
