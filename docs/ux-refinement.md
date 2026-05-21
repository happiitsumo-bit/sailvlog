# UX Refinement — ホーム＋全ページ共通体験の最適化

> **ステータス:** ドラフト / 実装前
> **作成日:** 2026-05-21
> **前提:** Phase 3 Teams・Phase 2b-lite Home Dashboard・RightSidebar 切り出し・データビジュアライゼーションが実装済み

---

## 1. 目的 — なぜこの改善をするか

sailvlog は「Knowledge that sails.（航海するナレッジ）」を掲げる、セーラーのための技術交換プラットフォームです。直近の Phase 2b-lite で **計器のような情報密度型ダッシュボード** を実装しましたが、実装後のレビューで以下の **UX上のひずみ** が見つかりました。

### 現状の主な課題

| # | 課題 | 影響 |
|---|---|---|
| A | TEAM HIGHLIGHTS（中央）と Team Power Ranking（右）が**ほぼ同じデータ**を表示している | ユーザーは同じ情報を2回見ることになり、画面の情報密度の割に得られる情報が少ない |
| B | Navigate タイルが、TopBar・ClassSidebar・BottomTabBar・Ctrl+K に続く **5番目のナビゲーション** になっている | 機能の重複でホームの貴重な1枠を消費している |
| C | RightSidebar が `layout.tsx` 配置のため、**Q&A詳細・記事詳細などコンテキストの違うページでも同じ統計が出る** | 詳細ページでは「Yachts一覧」「Team Ranking」が文脈とずれる |
| D | インラインスタイルが各コンポーネントに大量にあり、**同じパターンが何度もコピペ**されている（`overflow:hidden; textOverflow:ellipsis; whiteSpace:nowrap` の3点セットなど） | 保守性が落ち、デザイントークンを変えたいときに修正漏れが起きやすい |
| E | SVGドーナツ・横棒チャートに `aria-label` などのアクセシビリティ属性がない | スクリーンリーダー利用者に情報が届かない |
| F | シードデータが乏しい初期状態で、**「0pts」「0%」表示が並び、サイトが寂れて見える** | 新規訪問者の第一印象を損ねる |

### 想定主要ユーザー

| ユーザー像 | このサイトに来る理由 |
|---|---|
| **学生セーラー**（大学ヨット部員） | 大会向けの技術ノウハウ、他大学の動向、艇種別の知識を求める |
| **社会人セーラー / クラブ員** | 過去のセーリング知識の整理、Q&Aで初心者の質問への回答 |
| **指導者・コーチ** | 教材として参照記事を活用、新人への学習導線を示す |

これら3層に共通する体験原則は：

1. **開いた瞬間に「新しい情報・動き」が見える**こと（停滞感の排除）
2. **詰め込みすぎず、視線が次にどこへ向かうかが明確**であること
3. **どのページでも、その文脈に最適な周辺情報が右側に出る**こと（コンテキスト整合性）

---

## 2. 完成イメージ — ユーザーが何を見て、何を操作できるか

### 2.1 ホーム画面（変更後の bento-grid）

```
┌─────────────────────────────────────────────┐
│ ClassFocusTile  (2col × 2u)                 │
│ 今週の艇種フォーカス＋関連リファレンス3件   │
├──────────────────────┬──────────────────────┤
│ Pick Up Reference    │ Unsolved Q&A         │
│ (1col × 1u)          │ (1col × 1u)          │
├──────────────────────┴──────────────────────┤
│ Intelligence Feed   (2col × content height) │
│ 最新の記事・Q&A・投稿を時系列でマージ表示   │
├──────────────────────┬──────────────────────┤
│ ★ Sailor Spotlight   │ ★ Random Reference   │
│ (1col × 1u)          │ (1col × 1u)          │
│ ※TEAM HIGHLIGHTS    │ ※Navigate タイルを   │
│ から差し替え         │ から差し替え         │
└──────────────────────┴──────────────────────┘
```

★が今回の主な変更点です。

### 2.2 Sailor Spotlight（注目セーラー）

- **見えるもの:** 1人のセーラーを大きく取り上げるカード
  - アバター（ない場合はイニシャル円）
  - ユーザー名 / 所属大学 or チーム
  - 専門艇種（ClassFlag アイコン）
  - 1行のひと言（bio の冒頭、最大40字）
  - "X 件の投稿 / Y 件の回答" などの活動メタ
- **操作:** カード全体クリックで `/users/[username]` へ遷移
- **選定ロジック:**
  - 「直近30日で `articles + questions + posts + answers` の合計が多いユーザー」上位3人から、**日替わりで1人** をピック（`new Date().getDate() % 3`）
  - 該当者がいない場合は、全期間のアクティブユーザーから選定（フォールバック）
- **意図:** Phase 3 で実装した Sailors ページへの導線になり、かつ「人」が前面に出ることでサイトに体温が宿る

### 2.3 Random Reference（ランダム参照記事）

- **見えるもの:** Pick Up Reference とは別軸のリファレンス1件
  - タイトル
  - カテゴリバッジ
  - 1行サマリ
  - 「ふらっと読む →」リンク
- **選定ロジック:**
  - ページロードごとに `Math.floor(Math.random() * REFERENCES.length)` で選ぶ（ただし Pick Up Reference と重複しないように除外）
  - サーバー側でレンダリングするため、リロードのたびに変わる **"偶発的な発見"** の体験
- **意図:**
  - Pick Up Reference は「今日の推し（日替わり固定）」
  - Random Reference は「気まぐれな出会い」
  - 2つの違う性格のレコメンドを並べて、リファレンスの回遊性を高める
- **Pick Up Reference との差別化:** カードのビジュアルを明確に変える（左ボーダーではなく、右上に "RANDOM" の小バッジを置き、トーンを少し控えめにする）

### 2.4 ページ別 RightSidebar（コンテキスト連動）

| ページ | 右サイドバーの中身 |
|---|---|
| `/`（ホーム） | 現状維持（Q&A Status ドーナツ / Team Power Ranking / Yachts） |
| `/articles/[slug]` | 同じ艇種の関連記事 / 同じ著者の他記事 / Yachts |
| `/questions/[id]` | 関連 Q&A / 同じタグの Q&A / Q&A Status ドーナツ |
| `/teams/[slug]` | チームメンバー数値サマリ / 同地域の他チーム |
| `/reference`, `/reference/[slug]` | カテゴリ別リファレンスナビ |
| `/sailors`, `/users/[username]` | フォローおすすめ（仮）/ Yachts |
| その他 | デフォルト（ホームと同じ） |

実装は **Next.js App Router の Parallel Routes (`@rightSidebar`)** を使い、各セグメントに `default.tsx` と必要に応じた個別実装を置きます。

### 2.5 空状態（Empty State）の改善

「0件 / 0% / 0pts」を **前向きなコピー＋CTA** に置き換えます。

| 状況 | 現状 | 改善後 |
|---|---|---|
| Q&A solve率 0% | ドーナツが空リング | 「💡 未解決の質問があります。あなたの知識でコミュニティに貢献を」＋ "Q&Aへ" ボタン |
| Team Power Ranking 全0pts | 順位だけ並んで寂しい | "まだ各チームの活動がここに集まり始めたところです" の subtitle 追加 |
| Intelligence Feed 空 | 「まだ投稿がありません」 | 同じ文言＋「最初の記事を書く」CTA |
| Sailor Spotlight 該当者なし | — | "全セーラーを見る" 単独カードにフォールバック |

### 2.6 アクセシビリティ強化

- すべての SVG チャートに `role="img"` と `aria-label`（例: `aria-label="解決率 0%"`）
- ランキング Link に `aria-label="1位 京都大学 0ポイント"`
- ドーナツ内の数字テキストに `aria-hidden="true"` を付け、スクリーンリーダーに重複読み上げさせない
- TopBar / BottomTabBar の現在ページ表示に `aria-current="page"`

### 2.7 スタイル整理（ユーザーには見えないが体験に効く）

繰り返し使われるパターンを `globals.css` のユーティリティクラスへ抽出：

| 新クラス | 中身 |
|---|---|
| `.u-truncate` | `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` |
| `.u-mono-meta` | `font-family: var(--font-mono); font-size: 0.7rem; color: var(--fg-dim)` |
| `.u-stat-num` | `font-family: var(--font-display); letter-spacing: -0.03em` |
| `.u-card-soft` | `background: var(--card); border: 1px solid var(--border); border-radius: var(--radius)` |

各コンポーネントのインラインスタイルを段階的に置き換えます（一括ではなく、触る箇所から順次）。

---

## 3. 実装する機能の一覧

### 3.1 ホーム画面

- [ ] **Sailor Spotlight コンポーネント新規作成**（`components/SailorSpotlight.tsx`）
  - サーバーコンポーネントでユーザー一覧を取得
  - 直近30日アクティブ上位3人から日替わり1人ピック
  - フォールバックロジック（該当なし時）
- [ ] **Random Reference コンポーネント新規作成**（`components/RandomReference.tsx`）
  - `lib/mock-references.ts` からランダム1件
  - Pick Up Reference との重複除外
- [ ] **page.tsx 修正**
  - TEAM HIGHLIGHTS タイル → SailorSpotlight に差し替え
  - Navigate タイル → RandomReference に差し替え
  - 不要になった `topTeams` の fetch・ロジックを削除

### 3.2 RightSidebar のページ別出し分け

- [ ] **Parallel Routes 導入**（`app/@rightSidebar/`）
  - `app/@rightSidebar/default.tsx`（現状の RightSidebar を default 扱い）
  - `app/@rightSidebar/articles/[slug]/page.tsx`（記事ページ用）
  - `app/@rightSidebar/questions/[id]/page.tsx`（Q&A詳細用）
  - 必要に応じて段階的に追加
- [ ] **layout.tsx 修正**
  - `<RightSidebar />` 直接配置から `{rightSidebar}` プロップ受け取りへ
- [ ] **既存 RightSidebar.tsx の再利用**
  - default.tsx から呼び出す形でロジック温存

### 3.3 空状態改善

- [ ] **Q&A Status ドーナツ** — 0% 時の補助コピー＋CTAボタン追加
- [ ] **Team Power Ranking** — 全0pts時の subtitle 追加
- [ ] **Intelligence Feed** — 空状態に「最初の記事を書く」CTA
- [ ] **Sailor Spotlight** — 該当者なし時のフォールバックUI

### 3.4 アクセシビリティ

- [ ] RightSidebar の SVGドーナツに `role="img"` `aria-label`
- [ ] Team Ranking Link に `aria-label`
- [ ] ナビゲーション要素に `aria-current="page"`
- [ ] フォーカスリングのスタイル統一（`:focus-visible`）

### 3.5 スタイル整理

- [ ] **globals.css にユーティリティクラス追加**（`.u-truncate` ほか）
- [ ] **段階的にインラインスタイルを置き換え**（今回触るファイルから）

---

## 4. ファイル変更一覧

### 新規作成

| ファイル | 役割 |
|---|---|
| `frontend/src/components/SailorSpotlight.tsx` | 注目セーラー1名のカード |
| `frontend/src/components/RandomReference.tsx` | ランダムリファレンスカード |
| `frontend/src/app/@rightSidebar/default.tsx` | デフォルト右サイドバー（現状の RightSidebar をラップ） |
| `frontend/src/app/@rightSidebar/articles/[slug]/page.tsx` | 記事ページ用右サイドバー |
| `frontend/src/app/@rightSidebar/questions/[id]/page.tsx` | Q&A詳細用右サイドバー |
| `frontend/src/components/sidebar/ContextualSidebar.tsx`（仮） | コンテキスト別ウィジェットの共通ベース |

### 変更

| ファイル | 変更内容 |
|---|---|
| `frontend/src/app/layout.tsx` | `<RightSidebar />` 直接配置 → `rightSidebar` プロップ受け取りに変更 |
| `frontend/src/app/page.tsx` | TEAM HIGHLIGHTS → SailorSpotlight、Navigate → RandomReference |
| `frontend/src/components/RightSidebar.tsx` | 0% 時の補助コピー＋CTA追加、aria属性追加 |
| `frontend/src/components/IntelligenceFeed.tsx` | 空状態に CTA 追加 |
| `frontend/src/components/PickUpReference.tsx` | RandomReference と区別するためのスタイル微調整（"PICK UP" バッジを明示） |
| `frontend/src/app/globals.css` | ユーティリティクラス（`.u-truncate` ほか）追加、空状態用 `.empty-cta` クラス追加 |

### 削除

なし（既存のロジック・ファイルは温存）。ただし `page.tsx` の `topTeams` 関連ロジックは未使用化されるので削除。

---

## 5. 新しく登場する概念・技術

### 5.1 Next.js App Router の Parallel Routes（並列ルート）

**何か:** 1つのレイアウト内で複数のページを並列にレンダリングする仕組み。

**やり方:**

```
app/
├── layout.tsx          ← children と @rightSidebar を受け取る
├── page.tsx            ← 中央メインの中身
└── @rightSidebar/
    ├── default.tsx     ← どのページでも使われる「既定の」右サイドバー
    ├── articles/
    │   └── [slug]/
    │       └── page.tsx  ← /articles/:slug のときだけ使われる
    └── questions/
        └── [id]/
            └── page.tsx  ← /questions/:id のときだけ使われる
```

`layout.tsx` の型はこうなります：

```tsx
export default function RootLayout({
  children,
  rightSidebar,  // ← @rightSidebar の中身が入ってくる
}: {
  children: React.ReactNode;
  rightSidebar: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <TopBar />
          <ClassSidebar />
          <main className="app-main">{children}</main>
          {rightSidebar}   {/* ← ここに自動で適切な内容が入る */}
        </div>
      </body>
    </html>
  );
}
```

**この仕組みの応用例:**
- モーダルやドロワーを「並列ページ」として独立管理（ロード時に開いた状態を維持できる）
- ダッシュボードの各ウィジェット（チャート/フィード/通知）を独立に loading・error 制御
- 管理画面の左右パネルがページ遷移で別々に動く構成

**`default.tsx` とは:** 「対応する個別ページがないとき」のフォールバック。例えば `/teams/foo` を開いたとき、`@rightSidebar/teams/[slug]/page.tsx` がまだなければ `@rightSidebar/default.tsx` の中身が使われます。

### 5.2 ARIA 属性とアクセシビリティ

**何か:** WAI-ARIA は、HTMLだけでは伝わらない「役割・状態・関係」をスクリーンリーダーに伝える属性群。

**今回使う主なもの:**

| 属性 | 用途 |
|---|---|
| `role="img"` | SVGなど「画像として扱う要素」だと宣言 |
| `aria-label` | 画面に出ない説明テキスト |
| `aria-hidden="true"` | スクリーンリーダーに無視させたい装飾要素 |
| `aria-current="page"` | ナビゲーションで現在ページを示す |

**応用例:** チャートライブラリ・カスタムドロップダウン・モーダル・タブUIなど、ネイティブHTMLにない振る舞いをするコンポーネントすべてに必要になる知識。

### 5.3 Empty State Pattern（空状態デザイン）

**何か:** データが0件のときに「ただ空っぽ」ではなく、「これから何が起こるか」「ユーザーが次に何をすればよいか」を伝えるUIパターン。

**3要素:**

1. **状況の説明**（なぜ空なのか）
2. **次の行動の提示**（CTAボタン）
3. **トーン**（前向き・歓迎的）

**応用例:** どんなアプリでも「初回起動」「検索結果0件」「フォロワー0人」など空状態は必ずあるため、デザインシステムに組み込むべき汎用パターンです。

---

## 6. 実装順序の提案

依存関係を考えて、以下の順で進めることを推奨します：

| 段階 | 内容 | 理由 |
|---|---|---|
| 1 | スタイルユーティリティを globals.css に追加 | 後続の作業で使うため先に整える |
| 2 | SailorSpotlight 新規作成 | ホーム画面の差し替えでまず使う |
| 3 | RandomReference 新規作成 | 同上 |
| 4 | page.tsx の差し替え＋空状態改善 | ホーム画面の完成 |
| 5 | アクセシビリティ強化（aria属性） | 既存コンポーネントに追記するだけなので独立して進められる |
| 6 | Parallel Routes 導入（layout.tsx 改修＋default.tsx） | 構造変更なので慎重に。最低でもホームが壊れないことを確認 |
| 7 | ページ別 RightSidebar を1ページずつ追加 | 段階的に拡張 |

各段階の終わりに Playwright でスクリーンショットを撮り、視覚的に確認します。

---

## 7. やらないこと（スコープ外）

- ログイン必須機能の実装（フォロー、いいねなど）
- バックエンドDBへのReferences移行
- 新しい色やフォントの追加
- BottomTabBar / TopBar / ClassSidebar の構造変更
- モバイル専用UIの新規追加（既存のレスポンシブ対応の範囲内で動けばOK）

---

## 8. 確認したいこと

実装に入る前にユーザーに確認したい点：

1. **Sailor Spotlight の選定基準** — 「直近30日のアクティブ上位3人から日替わり」で問題ないか？それとも別の基準（例：bio が充実している順）が良いか？
2. **Random Reference のリロード挙動** — リロードごとに変わる仕様で良いか？それとも「ホームを開くたびに新規」より、もう少し落ち着いた更新頻度（例：1時間ごと）が良いか？
3. **Parallel Routes の導入タイミング** — 段階6・7は重い変更なので、まず段階1〜5までを1回のPRにして、Parallel Routes は別途進める形でも良いか？

承認後、段階1から実装に着手します。
