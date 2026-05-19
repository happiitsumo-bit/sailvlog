# sailvlog UI 批判レポート

> 作成: critic-agent  
> 対象: Next.js 14 + TypeScript フロントエンド（スナップショット 2025-05-19）

---

## 総評（3行以内）

提案書（research-report.md）の改善指摘の約40〜50%は実装されたが、最重要課題の「ヒーロー統計が表示件数を表示している」バグが依然残っており、コミュニティの信頼性を根本から損なっている。セーリングらしさは艇種カラーと波形区切り線が追加されたものの、装飾レベルに留まっており実際のセーラーの業務フローを支援するUXにはなっていない。技術的負債（Legacyエイリアス、型安全性の欠如）も放置されたままである。

---

## 重大な問題（即座に修正が必要）

### 問題1: ヒーロー統計が「取得件数の上限値」を表示しており数値として嘘をついている

**問題**  
`page.tsx` の `hero-stats` セクションで、`articles.length`（最大5）、`trendingQuestions.length`（最大3）、`recentPosts.length`（最大3）を「コミュニティ規模を示す指標」として表示している。APIを叩いたばかりで記事が1件しかなければ「1」と表示される。

**根拠**  
```tsx
// page.tsx L89-98
<div className="hero-stat-value">{articles.length > 0 ? articles.length : "—"}</div>
// getArticles() は ?limit=5 で叩いているため最大値は 5
```
提案書でも「致命的な問題（★★★）」と分類されていたにも関わらず未修正。成長しているコミュニティのように見せるはずのメトリクスが「5・3・3」で止まるのはユーザーの信頼を毀損する。

**修正案**  
`/api/stats` エンドポイントを作成するか、各 fetch のレスポンスに含まれる `total` フィールドを使う。表示値を取得件数ではなく `total` に差し替える。

---

### 問題2: `isLoggedIn()` をサーバーコンポーネントで呼べない構造的矛盾

**問題**  
`feed/page.tsx` は `"use client"` が付いており、`isLoggedIn()` をレンダリング時に呼んでいる。しかし `isLoggedIn` は localStorage / Cookie に依存する関数のはずで、SSR時はサーバー側で実行不可能なため、ハイドレーション不整合が発生する可能性が高い。

**根拠**  
```tsx
// feed/page.tsx L82
{isLoggedIn() ? (
  <div className="composer"> // サーバーとクライアントでレンダリング結果が異なる
```
Next.js 14 App Router では `"use client"` コンポーネントでも初回はサーバーで実行されるため、`localStorage` を参照する認証チェックは最初に `null` / `false` を返す。Composerがフラッシュして消えるか、ログイン済みユーザーに「ログインしてください」が表示される場面が起こりうる。

**修正案**  
`useEffect` + `useState` でマウント後にのみ `isLoggedIn()` を評価する。または `mounted` フラグを設けてCSR専用コンポーネントとして明示する。

---

### 問題3: `handleLike` でエラー時に `alert()` を使用しており本番品質でない

**問題**  
`feed/page.tsx` の `handleLike` 関数がエラー時に `alert()` を呼び出している。これはブラウザのネイティブダイアログを使うものでスタイル不可能・UXを壊す・テスト不可能。

**根拠**  
```tsx
// feed/page.tsx L68
} catch (e) {
  alert(e instanceof Error ? e.message : "エラーが発生しました");
}
```
同じファイルの `handlePost` ではちゃんと `setPostError` でインラインエラーを表示しているのに、`handleLike` だけ `alert()` を使っており一貫性もない。

**修正案**  
`handlePost` と同様にステート管理でエラーを表示するか、トースト通知コンポーネントを導入する。

---

### 問題4: `questions/page.tsx` の `searchParams` の型が Next.js 14 の仕様と合っていない

**問題**  
`searchParams: Record<string, string>` という型定義は、クエリパラメータが複数同名で渡された場合（例: `?tag=470&tag=ilca`）に実行時エラーを起こす。Next.js 14 の正式な型は `{ [key: string]: string | string[] | undefined }` である。

**根拠**  
```tsx
// questions/page.tsx L41-44
export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Record<string, string>; // 危険な型
})
```
`learn/page.tsx` も同様の問題を持っている。TypeScriptで型エラーは出ないが、`string[]` が来た場合に `URLSearchParams.set()` が `[object Object]` をセットする実行時バグになる。

**修正案**  
`searchParams: { [key: string]: string | string[] | undefined }` に変更し、各フィールドの使用箇所で `Array.isArray` チェックを入れる。

---

## 中程度の問題（次のイテレーションで対応）

### 問題5: ArticleCard に本文プレビューがなく、記事を選択する判断材料が不足している

**問題**  
カードにはタイトル・タグ・著者・統計数値しか表示されていない。ユーザーはタイトルだけでクリックするかを判断しなければならない。

**根拠**  
提案書で「★★★優先度（最高）」かつ「コスト低」と明記されていたが未実装。`article-card-excerpt` の CSSクラスは `globals.css` に追加されているにも関わらず、`ArticleCard.tsx` でそのクラスを使う箇所が一切存在しない。CSS だけ追加してコンポーネント修正を忘れた典型的な実装漏れ。

**修正案**  
`ArticleSummary` 型に `summary?: string` を追加し、`ArticleCard.tsx` で `article-card-excerpt` クラスを使ってプレビューを表示する。

---

### 問題6: Navbar の CLASS_LINKS がハードコードされており API の boatTypes と二重管理になっている

**問題**  
`Navbar.tsx` の `CLASS_LINKS` は固定配列（470/ILCA/Snipe/49er/Cruiser/Other）だが、`page.tsx` はAPIから `boatTypes` を取得している。艇種が増減した場合にNavbarだけ取り残される。

**根拠**  
```tsx
// Navbar.tsx L16-23
const CLASS_LINKS = [
  { slug: "470", label: "470" },
  { slug: "ilca", label: "ILCA" },
  // ... ハードコード
];
```
提案書でも「二重管理の可能性がある」と明記されていたが対処されていない。

**修正案**  
`Navbar.tsx` でサーバーサイドフェッチを行うか（`"use client"` が邪魔をするため難しい）、boatTypes をグローバルな context / layout での fetch に切り出し Navbar に渡す構造にする。

---

### 問題7: `post-header` でユーザー名が `post-author` と `post-handle` で重複表示されている

**問題**  
`page.tsx` および `feed/page.tsx` の post-card で、ユーザー名が「表示名」と「@ハンドル」の両方に同じ値が使われている。

**根拠**  
```tsx
// page.tsx L189-190
<Link href={`/users/${p.author.username}`} className="post-author">{p.author.username}</Link>
<span className="post-handle">@{p.author.username}</span>
```
`displayName` と `username` が分離されていないため、「田中 @tanaka123」のような表示ができず、すべてのユーザーが「tanaka123 @tanaka123」という冗長な表示になっている。データモデルか表示のどちらかを修正する必要がある。

**修正案**  
`author` 型に `displayName?: string` を追加するか、`post-handle` を表示するのをやめてどちらか片方に統一する。

---

### 問題8: Feed ページのサイドバーが事実上空で機能していない

**問題**  
サイドバーに「Today's Fleet: {total} posts total」と「Post Tips」テキストの2モジュールしかない。`total` はすべての投稿の合計件数であり「Today's」という名前と矛盾している。

**根拠**  
```tsx
// feed/page.tsx L149-158
<h3 className="sidebar-title">Today's Fleet</h3>
<p>...{total} posts total</p> // "total" は全期間の合計
```
提案書で「現状ほぼ空」と指摘され改善仕様まで書かれていたが、結果として提案書とほぼ同じ内容しか実装されていない。アクティブセーラーリスト・トレンドタグなど提案されていた要素はすべて未着手。

**修正案**  
少なくとも「Today's」という嘘のラベルを「Feed Stats」などに修正する。長期的にはアクティブユーザーリストや人気ハッシュタグを追加する。

---

### 問題9: Learn ページで `--cyan` という Legacy エイリアスが堂々と使われている

**問題**  
提案書が「Legacy エイリアスは削除候補」と明記しているにも関わらず、`learn/page.tsx` では削除対象のエイリアスが新規追加コードの中で使われている。

**根拠**  
```tsx
// learn/page.tsx L28
<span style={{ color: "var(--cyan)", ... }}>
```
`globals.css` では `--cyan: var(--sage)` というエイリアスが定義されており、これは旧体系の名称。新規コードでは `var(--sage)` を直接使うべきで、Legacy エイリアスの使用を広げている。

**修正案**  
`var(--cyan)` を `var(--sage)` に変更し、Legacy エイリアスが新規コードに混入するのを防ぐ。

---

### 問題10: `stagger` アニメーションが8要素までしか対応していない

**問題**  
`globals.css` の `.stagger > *:nth-child(n)` が8番目までしか定義されておらず、9件目以降の要素は `opacity: 0` のまま表示されない。

**根拠**  
```css
/* globals.css L1784-1791 */
.stagger > *:nth-child(1) { animation-delay: 0.05s; }
...
.stagger > *:nth-child(8) { animation-delay: 0.4s; }
// 9件目以降は opacity: 0 で初期化されたまま animation が発火しない
```
`getArticles()` が `limit=5` を返している間は問題ないが、ページネーションや表示件数を増やした瞬間に記事が消えるバグになる。

**修正案**  
`CSS @layer` か `CSS Custom Properties` でより汎用的に書き直す。または `animation-delay: calc(0.05s * var(--stagger-index))` をインラインスタイルで渡すReact実装に切り替える。

---

## 軽微な問題・改善余地

### 問題11: `hero-corner` の静的ウィンドデータが誤解を招く

`"Northwest · 14kt · SE"` は完全な静的文字列であり、実際の気象データではない。提案書では「将来のAPI連携のための `id="wind-badge"` を付与する」という最低限の対処が提案されていたが何もされていない。初見ユーザーが本物のデータだと誤解するリスクがある。少なくとも装飾であることを示す区別が必要。

### 問題12: `question-card` が `<Link>` で囲まれているが内部の `<a>` タグ相当要素とネストする

`questions/page.tsx` でQuestion全体を `<Link>` で囲み、内部でタグ（`<span className="tag">` は問題ないが、将来 `<Link>` を追加した場合）をネストするとHTML仕様違反になる。現状はタグが `<span>` なので問題ないが、設計上のリスクがある。

### 問題13: `ArticleCard` のカード全体 hover で子リンクが操作しにくくなる

`article-card:hover` が `transform: translateY(-3px)` を適用するため、カード上のタグリンクや著者リンクをホバーしたとき親カードが浮き上がり、ターゲット領域が視覚的にずれる。タッチデバイスでは問題ないが、マウス操作では混乱を招く。

### 問題14: `wave-divider` が globals.css に定義されているが、どのページでも使われていない

提案書で「最も手軽なオリジナリティ追加（★★☆）」と評価されたが、CSS定義だけ追加されて1箇所も JSX で使われていない。デッドコード。

### 問題15: `Sailors` ページの `s.experienceYears` の単位が不明瞭

`{s.experienceYears}y` の `y` が年（year）であることは開発者には自明でも、ユーザーには「ヤード」や「yen」など別の意味に見える可能性がある。`{s.experienceYears}年` に変えるべき。

### 問題16: `composer-counter` の文字色変化しきい値の設定が若干おかしい

```tsx
// feed/page.tsx L91
draft.length > max - 20 ? "var(--terra)" : draft.length > max - 50 ? "var(--dijon)" : undefined
```
条件式の評価順序が逆転している。`max - 20` が先に評価されるため `max - 50` の条件が正しく機能するが、読み解きにくい。また提案書では「`max - 30` から `max - 20` へ変更」という提案だったが、コードでは `max - 50` になっており数値の根拠が不明。

---

## 提案書との乖離（実装されなかった・誤って実装された箇所）

| 提案内容 | 優先度 | 状況 | 問題の深刻度 |
|---------|--------|------|------------|
| ヒーロー統計を `total` で表示 | ★★★ | **未実装** | 高（表示値が嘘になっている） |
| ArticleCard に本文プレビュー追加 | ★★★ | **CSSのみ追加、TSX未修正** | 高（意味のないデッドCSS） |
| Feedサイドバー充実（アクティブセーラー等） | ★★☆ | **最小限のみ（ほぼ未実装）** | 中 |
| `wave-divider` の実際の適用 | ★★☆ | **CSS定義のみ、JSXで使用ゼロ** | 中（デッドコード） |
| Navbarのクラスリンクにカラードット | ★★☆ | **未実装** | 中 |
| `CLASS_LINKS` のAPI化 | 未評価 | **未実装** | 中 |
| Articlesページのフィルター/アクションボタン分離 | ★★☆ | **未実装** | 低 |
| `rope-rule` 区切り線 | ★☆☆ | **未実装（低優先度なので許容範囲）** | 低 |
| `wind-rose` CSS実装 | ★☆☆ | **未実装（低優先度なので許容範囲）** | 低 |
| Legacy エイリアス削除 | ★☆☆ | **未実装どころか新規コードで使用増加** | 中 |
| Sailorsページ検索デバウンス | ★☆☆ | **実装済み** | — |
| 艇種カラーコーディング (globals.css) | ★★★ | **実装済み** | — |
| Q&A解決済みカード左ボーダー | ★★☆ | **実装済み** | — |
| Learn 難易度バー | ★★☆ | **実装済み** | — |
| Learn accentColor の course-card::before | ★★☆ | **実装済み** | — |
| Sailorsページ search-box クラス分離 | ★☆☆ | **実装済み** | — |

**特に問題な乖離**:  
提案書で最高優先度（★★★）と評価された「ArticleCard 本文プレビュー」は、CSSクラス（`.article-card-excerpt`）の追加のみで止まっており、実際のコンポーネント修正が抜け落ちている。これはコードレビューで必ず検出されるべき実装漏れである。

---

## 肯定的評価（批判の参考として：うまくいっている部分）

以下の点は適切に実装されており、変更すべきでない。

1. **デザイントークンの骨格は堅牢** — `--terra`/`--sage`/`--dijon` の3色体系は「テラコッタ・海・陽光」のセーリング的含意を持ち、一貫性がある。

2. **艇種カラーコーディング（`data-class` 属性）** — `boat-badge[data-class="470"]` のCSS属性セレクタによる実装は、クラス名の肥大化を防ぎつつ意味ある色付けを実現している。提案書の意図を正しく反映している。

3. **Sailors ページのデバウンス実装** — `useRef` + `setTimeout` を使った 300ms デバウンスは正しく実装されており、不必要なAPIコールを防いでいる。

4. **モバイルレスポンシブの対応範囲** — 480px / 768px / 980px の3段階ブレークポイントは適切で、`question-card` のメトリクスカラムがモバイルで横並びに変わる処理なども丁寧に対応している。

5. **Navbar のアクセシビリティ基礎** — ハンバーガーボタンに `aria-label` と `aria-expanded` が正しく設定されており、スクリーンリーダーへの最低限の配慮がある。

6. **`article-card:focus-visible` の実装** — `:hover` だけでなく `:focus-visible` も定義されており、キーボード操作ユーザーへの配慮がある。
