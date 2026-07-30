# sailvlog 世界水準レビュー v2

> critic-agent による容赦なき査定。基準は「Figma / Notion / Linear / Discord と並べて恥ずかしくないか」の一点。

---

## 総評（「世界に出せるか」一言で）

**出せない。日本語圏のセーリング愛好家向けの試作品としては完成度が高いが、グローバルプロダクトとして名乗るには構造的欠陥が3つ、品質問題が多数ある。**

---

## 🔴 致命的な問題（リリース前に必須）

### 1. ナビゲーションアイコンが文字記号のまま

**問題**
`ClassSidebar.tsx` および `BottomTabBar.tsx` の両コンポーネントで、ナビアイコンが `⌂ ◈ ? ▶ ◉` という Unicode 記号で代用されている。

```tsx
// ClassSidebar.tsx / BottomTabBar.tsx — 共通で同じ定義が重複
const NAV_ITEMS = [
  { href: "/", icon: "⌂", label: "Home" },
  { href: "/feed", icon: "◈", label: "Feed" },
  { href: "/questions", icon: "?", label: "Q&A" },
  ...
];
```

**根拠**
Discord は Phosphor Icons + SVG スプライトで解像度・サイズ非依存のアイコン体系を持つ。Linear は Lucide を採用している。文字記号はフォントによってグリフが異なり、OS 間で見た目が崩れる。`?` をアイコンとして使うのは特に深刻で、ユーザーはエラー表示と混同する可能性がある。また、`⌕`（TopBar の検索アイコン）も文字記号。

**修正案**
`lucide-react` または `@heroicons/react` を導入し、SVG コンポーネントに置き換える。`Home`, `Rss`, `HelpCircle`, `BookOpen`, `Users` に対応するアイコンを使用する。

---

### 2. ハードコードされた日本語テキストが多数あり、国際化が不可能

**問題**
以下の日本語テキストがコードに直接埋め込まれており、多言語対応の設計がゼロ。

| ファイル | 日本語テキスト |
|---|---|
| `TopBar.tsx` L29 | `"記事・質問・セーラーを検索..."` (検索プレースホルダー) |
| `feed/page.tsx` L77 | `"セーラーの今を短く共有 — 風向き、セッティング、練習のメモ。"` |
| `feed/page.tsx` L105 | `"今日の気付きを共有 — 風向き、セッティング、練習のメモ..."` |
| `feed/page.tsx` L145 | `"投稿するには ログイン が必要です。"` |
| `questions/page.tsx` L133 | `"艇種・タグを指定して質問するほど、回答が集まりやすくなります。"` |
| `questions/page.tsx` L140-144 | 「質問のコツ」全体が日本語 |
| `page.tsx` L91, L109, L163 | `"最初の一本を投稿しよう"`, `"最初の質問者になろう"`, `"タイムラインに投稿しよう"` |
| `page.tsx` L210-213 | 「Sailing Tips」サイドバー全体が日本語 |
| `feed/page.tsx` L202-204 | 「Post Tips」サイドバーが日本語 |
| `sailors/page.tsx` L99 | `"検索条件を変えてみよう"` |
| `learn/page.tsx` L69 | `"まもなく公開予定"` |

特に `<html lang="ja">` (`layout.tsx` L14) が固定されており、英語話者のスクリーンリーダーが正しく動作しない。

**根拠**
Figma、Notion、Linear はすべて英語 UI をベースとして多言語を重ねる。日本語が UI に直書きされたプロダクトは、英語圏のベンチャーキャピタルの審査を通過できない。

**修正案**
最低限、UI テキストを英語に統一する。将来的には `next-intl` や `next-i18next` で i18n 対応。`<html lang="ja">` を `<html lang="en">` に変更する（または動的に切り替える）。

---

### 3. SkeletonCard が実際のローディング状態に使われていない

**問題**
`SkeletonCard.tsx` に `SkeletonArticleCard`、`SkeletonPostCard`、`SkeletonQuestionCard` の3コンポーネントが実装されているにもかかわらず、`feed/page.tsx`・`sailors/page.tsx` のローディング状態では空の `empty-state` に「Loading…」テキストを表示するだけで、Skeleton UI が使われていない。

```tsx
// feed/page.tsx L154-158 — Skeleton を使っていない
{loading ? (
  <div className="empty-state">
    <div className="empty-state-icon">○</div>
    <p className="empty-state-text">Loading…</p>  {/* ← Skeleton を使え */}
  </div>
) : ...}
```

**根拠**
Linear・Notion のローディングは必ず Skeleton UI で行われ、コンテンツが入る場所の形をあらかじめ提示することでレイアウトシフトを防ぐ。「Loading…」テキストのみでは 2018 年以前のプロダクトと同等の品質。

**修正案**
`feed/page.tsx` では `Array(5).fill(0).map((_, i) => <SkeletonPostCard key={i} />)` に置き換える。`sailors/page.tsx` でも同様のパターンで実装する。

---

## 🟠 重大な問題（品質に直結）

### 4. NAV_ITEMS が ClassSidebar と BottomTabBar で完全に重複定義

**問題**
全く同じ配列が2ファイルに分けて書かれており、ナビゲーション項目の追加・変更で必ず2か所の修正が必要になる。

```tsx
// ClassSidebar.tsx L10-16 と BottomTabBar.tsx L6-12 が完全一致
const NAV_ITEMS = [
  { href: "/", icon: "⌂", label: "Home" },
  { href: "/feed", icon: "◈", label: "Feed" },
  ...
];
```

**修正案**
`src/config/navigation.ts` に共通定義を切り出して両コンポーネントからインポートする。

---

### 5. インラインスタイルの多用

**問題**
`style={{}}` の多用が全ページで確認できる。特に以下が深刻。

- `feed/page.tsx`: composer のアバター部分が12行のインラインスタイル（L86-99）
- `learn/page.tsx`: レベルセクションのタイトル・ピップUIがすべてインラインスタイル（L76-119）
- `sailors/page.tsx`: specialty バッジ（L124-131）、experience バッジ（L129-133）がインラインスタイル
- `page.tsx`: Welcome Header全体（L58-78）がインラインスタイル
- `questions/page.tsx`: 「質問のコツ」リスト（L141-145）がインラインスタイル

Figma・Linear のフロントエンドは CSS Modules か Tailwind で管理され、デザイントークンへの参照が一元化されている。

**修正案**
繰り返し出現するパターン（バッジ、メタ情報、アバター）はグローバルCSSに `.specialty-badge`、`.experience-badge` などのクラスとして切り出す。または Tailwind へ統一移行する。

---

### 6. 空コンテンツ状態のアイコンが「○」で意味不明

**問題**
すべての empty state で `empty-state-icon` に `▲` または `○` が使われている。`○` は特に「空」「無」を表す記号として意味が曖昧すぎる。

```tsx
// 複数ファイルで繰り返されるパターン
<div className="empty-state-icon">○</div>
<p className="empty-state-text">NO POSTS YET</p>
```

**根拠**
Notion の empty state はイラスト、Figma は文脈に合ったアイコンと説明文、Linear は短いユーモアのあるコピーと CTA ボタンを組み合わせる。丸い記号1文字は説明責任を果たしていない。

**修正案**
文脈に応じた SVG イラストまたは Lucide アイコンを使い、「何もない理由」と「何をすればいいか」を示す CTA ボタンを添える（例：「Be the first to post → Post Now」ボタン）。

---

### 7. `layout.tsx` の `<html lang="ja">` とメタデータの矛盾

**問題**
`layout.tsx` の metadata で description は英語 (`"A technical exchange platform for sailors..."`) なのに `<html lang="ja">` が設定されている。スクリーンリーダーは `lang` 属性で音声合成エンジンを選択するため、英語テキストが日本語エンジンで読み上げられる。

**修正案**
`<html lang="en">` に修正する。または locale-aware routing を実装する。

---

### 8. サイドバーのユーザーセクションのログアウトボタンが `✕` 一文字

**問題**
`ClassSidebar.tsx` L105 のログアウトボタンが `✕` という1文字で、アクセシビリティ的に role も aria-label も `title="Logout"` しかない。スクリーンリーダーユーザーには何のボタンか判断しにくい。

また、ユーザー名のみ表示で実名・アバター画像・通知バッジ等がなく、Discord のサイドバー下部ユーザーエリアと比べると情報量が著しく少ない。

**修正案**
`aria-label="Log out"` を明示し、アイコンは `LogOut` SVG に置き換える。将来的にはアバター画像対応、通知バッジ追加を計画する。

---

## 🟡 改善余地（磨き込み）

### 9. ArticleCard の日付フォーマットが `ja-JP` 固定

`ArticleCard.tsx` L9 で `toLocaleDateString("ja-JP", ...)` が使われており、外国人には読みにくい `2025.01.15` 形式になる。`"en"` または `intl.DateTimeFormat` でロケール対応が必要。

### 10. globals.css に未使用の `.hero` クラスが残存

HomeページはHeroセクションを廃止済みだが、`globals.css` L399-483 に `.hero`、`.hero-inner`、`.hero-eyebrow`、`.hero-title`、`.hero-sub`、`.hero-cta-group`、`.hero-corner`、`.hero-stats` 等のCSSが大量に残っている。デッドコードはバンドルサイズを増やし、保守コストを上げる。削除を推奨する。

### 11. モバイルローディングが `empty-state` のスタイルを流用している

Loading状態と「コンテンツが0件」状態が同一の `.empty-state` クラスを使っているため、視覚的な区別がない。ローディング中にユーザーが「投稿がない」と誤解するリスクがある。

### 12. `questions/page.tsx` の boatType フィルターがサイドバーにあるが、TopBarの検索と連動していない

検索・フィルタリングのインタラクションが分散しており、一貫した検索体験になっていない。Linear の検索は単一のコマンドパレットですべてのフィルタリングを処理する。

### 13. `feed/page.tsx` のエラーメッセージが日本語混在

```tsx
setPostError(e instanceof Error ? e.message : "投稿に失敗しました。ログインしているか確認してください。");
setLikeError(e instanceof Error ? e.message : "いいねに失敗しました");
```
UI言語と一致しないエラーメッセージは多言語対応の妨げになる。

### 14. `ClassSidebar.tsx` の Cruiser クラスがフラグ画像なし

```tsx
{ slug: "cruiser", label: "Cruiser", flag: null },
```
フラグ画像がない艇種は `border` 色の空白矩形で代替されており、他の艇種と視覚的なバランスが崩れている。インラインスタイル（`style={{ width: 28, height: 18, ... }}`）で処理されており、クラスも当てていない。

---

## 確認できた良い点（変えるべきでない）

- **デザイントークンが徹底されている**: `globals.css` のカスタムプロパティ体系（`--terra`, `--sage`, `--paper`等）は一貫しており、Figmaのスタイル管理に相当する設計になっている。
- **セリフフォント + モノスペースの組み合わせ**: Source Serif 4 と IBM Plex Mono の組み合わせはセーリング・航海という世界観に合った、差別化されたビジュアルアイデンティティを作れている。Notion の Tiempos に匹敵する方向性。
- **`SkeletonCard.tsx` の設計自体は正しい**: 3種類（ArticleCard, PostCard, QuestionCard）のスケルトンを用意している点は正しい判断。使われていないのが問題なだけ。
- **サーバーコンポーネントの活用**: `page.tsx`・`questions/page.tsx`・`learn/page.tsx` が Server Components として実装されており、初期表示のパフォーマンスが確保されている。
- **`not-found.tsx` のコピーが秀逸**: `"the wind took it somewhere else"` は sailvlog の世界観に合ったユーモアで、404ページとして記憶に残るコピー。これは変えるべきでない。
- **Question カードのメトリクス表示（Answers/Votes/Views）**: Stack Overflow 型の回答数・投票数・閲覧数の3軸表示は適切で、情報の優先度が明確。
- **`getAvatarColor` ユーティリティ**: ユーザー名からハッシュで色を生成するアバター着色は、アバター画像なしの状態でも識別性を担保しており、設計として優れている。
