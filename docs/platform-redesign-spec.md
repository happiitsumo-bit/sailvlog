# sailvlog 全面リデザイン仕様書 (v2)

## 1. 目的

セーラー同士の技術交流が **このサイトだけで完結する** 専門プラットフォームへ。
現在のシンプルなブログ型 → **Q&A + フィード + 学習コース + コミュニティ**を備えた本格プラットフォームへ進化させる。

デザインは **レーシング・スポーティ風**。F1・競技ヨット雑誌・スポーツメディア(The Athletic, ESPN, Red Bull)のような**疾走感とプロ感**を全面に。

---

## 2. デザイン方針

### コンセプト: "WIND READS YOU"

帆走中の「風を読む」感覚を、UI の動きと配色で表現する。

### カラーパレット

| トークン | 色 | 用途 |
|---|---|---|
| `--ink` | `#0a0e1a` | メイン背景（深夜の海） |
| `--ink-2` | `#11172a` | カード背景 |
| `--ink-3` | `#1a2138` | ホバー・サブ背景 |
| `--bone` | `#f4f4f1` | テキスト・前景 |
| `--bone-mute` | `#8b95a8` | サブテキスト |
| `--flare` | `#ff3d00` | プライマリアクセント（風・速度・警告） |
| `--cyan` | `#00d9ff` | セカンダリアクセント（波・データ） |
| `--lime` | `#c4ff00` | サクセス・ハイライト |
| `--border` | `rgba(255,255,255,0.08)` | 細い分割線 |

### タイポグラフィ
- **Display**: `Space Grotesk` 800/900（大きな数字・見出し・ブランド）
- **Body**: `Inter` 400/500（本文・UI）
- **Mono**: `JetBrains Mono`（メトリクス・タグ・コード）
- 大きさ・余白で**情報のヒエラルキー**を明確化。サイズコントラストを大胆に。

### 視覚要素
- **斜めグラデーション・斜線**: 速度感
- **大きな数字**: 統計・順位・「読了時間」を強調
- **小さな全角／半角ラベル**: `// CATEGORY`, `→ NEXT` のような competitive sport 用語
- **マイクロアニメーション**: 数値カウントアップ、hover で線が走る、stagger 読み込み
- **グリッドレイアウト**: 非対称・大胆な余白・カードの重なり

---

## 3. 実装する機能（5領域）

### A. **トップページ全面刷新** (フィード兼ハブ)
- ヒーロー: 「WIND READS YOU」+ リアルタイム統計（今日の記事数・アクティブセーラー数）
- **2カラム + 横スクロール**: メインフィード / トレンド / 人気タグ
- **タイムライン投稿**（既存記事と混在表示）

### B. **Q&A 機能** (新規)
- `/questions` 一覧、`/questions/[id]` 詳細
- 質問投稿フォーム（タイトル + 本文 Markdown + 艇種 + タグ）
- 回答投稿、ベストアンサーマーク、票
- DB: `Question`, `Answer` テーブル新規追加

### C. **リアルタイムフィード** (新規)
- 短文投稿 (Tweet 風)、最大 300 文字
- `/feed` でタイムライン表示
- DB: `Post` テーブル新規追加 (Article とは別)

### D. **学習コース・ナレッジマップ** (新規)
- `/learn` で初心者→中級→上級のカリキュラム
- 艇種ごとのカリキュラム（既存記事を「コース」にまとめる仕組み）
- DB: `Course`, `CourseArticle` (中間) テーブル新規追加

### E. **セーラー検索・プロフィール強化**
- `/sailors` セーラー一覧 + 検索（艇種フィルタ・経験年数）
- プロフィール拡張: 艇種・経験年数・所属・専門分野・大会成績
- DB: `User` テーブルに `bio`, `boatTypeId`, `experienceYears`, `affiliation`, `specialty` カラム追加

---

## 4. ファイル変更一覧

### バックエンド
| ファイル | 変更内容 |
|---|---|
| `backend/prisma/schema.prisma` | `Question`, `Answer`, `Post`, `Course`, `CourseArticle` テーブル追加。`User` にプロフィール拡張カラム追加 |
| `backend/src/routes/questions.ts` | **新規** Q&A API |
| `backend/src/routes/posts.ts` | **新規** タイムライン投稿 API |
| `backend/src/routes/courses.ts` | **新規** コース API |
| `backend/src/routes/sailors.ts` | **新規** セーラー検索 API |
| `backend/src/routes/users.ts` | プロフィール更新エンドポイント拡張 |
| `backend/src/index.ts` | 新ルートをマウント |
| `backend/prisma/seed.ts` | コース・タグ・サンプル質問を追加 |

### フロントエンド
| ファイル | 変更内容 |
|---|---|
| `frontend/src/app/globals.css` | **全面書き換え**（レーシング系トークン・新コンポーネントCSS） |
| `frontend/src/app/layout.tsx` | フォント Google Fonts 読み込み、html クラス変更 |
| `frontend/src/components/Navbar.tsx` | ナビ刷新（Q&A・Feed・Learn・Sailors リンク追加） |
| `frontend/src/components/ArticleCard.tsx` | レーシング系カードに |
| `frontend/src/app/page.tsx` | ハブ型トップに刷新 |
| `frontend/src/app/questions/page.tsx` | **新規** Q&A 一覧 |
| `frontend/src/app/questions/new/page.tsx` | **新規** 質問投稿 |
| `frontend/src/app/questions/[id]/page.tsx` | **新規** 質問詳細 + 回答 |
| `frontend/src/app/feed/page.tsx` | **新規** タイムライン |
| `frontend/src/app/learn/page.tsx` | **新規** コース一覧 |
| `frontend/src/app/learn/[slug]/page.tsx` | **新規** コース詳細 |
| `frontend/src/app/sailors/page.tsx` | **新規** セーラー一覧 |
| `frontend/src/app/users/[username]/page.tsx` | プロフィール拡張表示 |
| `frontend/src/app/users/[username]/edit/page.tsx` | **新規** プロフィール編集 |
| `frontend/src/types.ts` | 新型定義追加 |

---

## 5. 新しく登場する概念・技術

### Prisma マイグレーション
- DB スキーマを変更したら `prisma migrate dev --name xxx` で新マイグレーションが生成される
- 既存データを保持したまま新テーブルを追加する仕組み

### CSS `@property` & カスタムプロパティ
- アニメーション可能な CSS 変数を定義できる（数値カウントアップなどに使用）

### CSS `mask-image` / グラデーションマスク
- 文字や図形の一部だけグラデーション着色する効果に使う

### Next.js 14 `searchParams`
- `/sailors?boat=470&years=3` のような URL クエリでフィルタリング

### スケルトンローダー
- 読み込み中に骨組みだけ表示するUI（プロらしさが出る）

---

## 6. 実装ステップ（順序）

1. **Prisma スキーマ拡張 + マイグレーション**（DB の土台）
2. **バックエンド API 実装**（Q&A → Post → Course → Sailors）
3. **globals.css 全面書き換え**（デザイントークン）
4. **共通コンポーネント**（Navbar / ArticleCard / 新規カード類）
5. **トップページ刷新**
6. **新規ページ**（Q&A / Feed / Learn / Sailors）
7. **プロフィール拡張**

---

## 7. 変更しないもの

- 認証 (JWT) の基本フロー
- いいね・ブックマーク・コメント・フォローの既存 API
- 既存記事データ（マイグレーションで保持）
- Docker / 起動手順

---

## 8. スコープに含めないもの（次回以降）

- 通知システム
- DM・チャット機能
- 画像アップロード
- 検索の全文検索化（今回は単純な LIKE 検索）
- ダーク/ライト切り替え（**ダーク固定**で本格感を出す）
