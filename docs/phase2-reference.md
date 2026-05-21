# Phase 2 実装企画書
## Reference（艇種・用語辞典）ページ

**バージョン:** 1.0  
**作成日:** 2026-05-20

---

## 1. 目的

「ヨットの技術情報がない・見つけにくい」という本質課題に直接応える。  
`/reference` 以下に「定義集」を作り、Q&AやArticleへの知識の入口を作る。

---

## 2. ページ構成

### `/reference` — 一覧ページ

```
┌─────────────────────────────────────────────────┐
│  Reference                                        │
│  ヨット競技の用語・技術・艇種の定義集             │
│                                                   │
│  [艇種] [技術] [ルール] [装備]  ← フィルターチップ│
│                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│  │ 470          │ │ ILCA         │ │ Snipe    │ │
│  │ 艇種         │ │ 艇種         │ │ 艇種     │ │
│  │ 中級・国際   │ │ 上級・五輪   │ │ 中級     │ │
│  └──────────────┘ └──────────────┘ └──────────┘ │
│                                                   │
│  ┌──────────────────────────────────────────────┐│
│  │ クローズホールド  技術  基礎                  ││
│  │ 風に向かって斜め前方に進む帆走ポイント        ││
│  └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

### `/reference/[slug]` — 詳細ページ（3段構成）

```
┌──────────────────────────────┬────────────────────┐
│  [← Reference]               │  目次              │
│                               │  ─ 概要            │
│  470                          │  ─ 詳細            │
│  ────────────────────         │  ─ セッティング     │
│  [艇種] [中級] [国際クラス]  │                    │
│                               │  関連 Reference    │
│  ① 概要                      │  ・ILCA            │
│  ─────────────────            │  ・49er            │
│  470は...（2〜3行の定義）     │                    │
│                               │  この用語を使った  │
│  ② 詳細解説                  │  記事              │
│  ─────────────────            │  ・[記事タイトル]  │
│  （Markdown本文）             │  ・[記事タイトル]  │
│                               │                    │
│  ③ 関連リンク                │  関連 Q&A          │
│  ─────────────────            │  ・[質問タイトル]  │
│  記事 3件 / Q&A 5件           │  ・[質問タイトル]  │
│  [もっと見る]                 │                    │
└──────────────────────────────┴────────────────────┘
```

---

## 3. データ構造（バックエンドとの連携）

Referenceエントリは以下のフィールドを持つ：

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `slug` | string | URL用の識別子（例: `470`, `close-hauled`） |
| `title` | string | 表示名（例: 「470」「クローズホールド」） |
| `category` | enum | `boat_class` / `technique` / `rule` / `gear` |
| `level` | enum | `beginner` / `intermediate` / `advanced` |
| `summary` | string | 2〜3行の定義（一覧カードに表示） |
| `body` | string | Markdown本文（詳細解説） |
| `relatedSlugs` | string[] | 関連Referenceのslug配列 |

---

## 4. コンポーネント構成

### 新規作成

| ファイル | 役割 |
|---------|------|
| `frontend/src/app/reference/page.tsx` | Reference一覧ページ |
| `frontend/src/app/reference/[slug]/page.tsx` | Reference詳細ページ（3段構成） |
| `frontend/src/components/ReferenceCard.tsx` | 一覧用カード |
| `frontend/src/components/ReferenceSidebar.tsx` | 詳細ページ右カラム（関連記事・Q&A） |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/config/navigation.ts` | NAV_ITEMSに「Reference」を追加 |
| `frontend/src/components/ClassSidebar.tsx` | Referenceリンクをナビに追加 |
| `frontend/src/app/globals.css` | Referenceカード・詳細ページのスタイル追加 |

---

## 5. デザイン言語（既存テーマとの統合）

### Referenceカードの視覚的差別化

```
Article カード  → クリーム地・ホバーで浮き上がる（既存）
Reference カード → 左に3pxの「分類カラーバー」付き
                   [艇種] → var(--terra)
                   [技術] → var(--sage)
                   [ルール] → var(--dijon)
                   [装備] → var(--fg-mute)
```

### 詳細ページの3段レイアウト

```css
/* 3段構成の区切り */
① 概要  → 大きめフォント、背景 var(--card-warm)、強調表示
② 詳細  → 既存 .markdown-body スタイルをそのまま流用
③ 関連  → .sidebar-list スタイルを流用
```

---

## 6. バックエンド追加エンドポイント

| エンドポイント | 説明 |
|--------------|------|
| `GET /api/references` | 一覧取得（カテゴリ・レベルフィルター対応） |
| `GET /api/references/:slug` | 詳細取得 |
| `GET /api/references/:slug/articles` | このReferenceに関連する記事 |
| `GET /api/references/:slug/questions` | このReferenceに関連するQ&A |

---

## 7. 初期データ（ハードコードで始める）

バックエンドAPIが整うまでの間、`/lib/mock-references.ts` に初期データをハードコードして開発を進める。

**艇種（6件）**
- 470, ILCA, Snipe, 49er, 420, OP

**技術用語（10件）**
- クローズホールド、リーチング、ランニング、タック、ジャイブ、
- ダウンホール、アウトホール、バックステイ、マークルーム、スタート

---

## 8. 実装順序

1. `globals.css` にReferenceカード・詳細ページのCSS追加
2. `mock-references.ts` に初期データを作成
3. `ReferenceCard.tsx` コンポーネント作成
4. `/reference/page.tsx` 一覧ページ作成（モックデータで表示）
5. `ReferenceSidebar.tsx` 作成
6. `/reference/[slug]/page.tsx` 詳細ページ作成
7. `navigation.ts` と `ClassSidebar.tsx` にReferenceリンク追加
8. バックエンドAPIが揃い次第、モックデータをAPI呼び出しに差し替え

---

**GOサインをいただければ実装を開始します。**
