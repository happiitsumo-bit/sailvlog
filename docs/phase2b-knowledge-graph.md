# Phase 2b 実装企画書
## 知識グラフの構築 〜Referenceを孤立ページから「網」へ〜

**バージョン:** 1.0
**作成日:** 2026-05-20

---

## 1. 目的

Phase 2aで作成したReferenceページは現在「孤立したページ」の状態。
本フェーズでは既存の記事・Q&AとReferenceを有機的に結びつけ、
「知識の発見性」を飛躍的に高める。

---

## 2. 実装する機能（2つ）

---

### 機能① Ctrl+K コマンドパレットの高度化

#### 完成イメージ

```
┌─────────────────────────────────────────────┐
│ ⌕  470 と入力                               │
├─────────────────────────────────────────────┤
│ ◇ Reference                                 │  ← 最上部に優先表示
│   470           艇種・中級                  │
│                                             │
│ ▲ Articles                                  │
│   スタートは大切    @daichi                 │
│                                             │
│ ? Q&A                                       │
│   470のセッティングは？   2 answers         │
└─────────────────────────────────────────────┘
```

#### 変更点

| 項目 | 現状 | 変更後 |
|------|------|--------|
| 検索対象 | 記事・質問・ユーザー（APIのみ） | Reference（ローカル）+ 記事・質問（API） |
| 表示順 | 混在 | Reference → Articles → Q&A → Sailors |
| Referenceの検索方法 | なし | モックデータをローカルで検索（APIなし） |
| セクションヘッダー | なし | カテゴリ別に「◇ Reference」「▲ Articles」「? Q&A」を表示 |

#### 技術的な実装方針

- Referenceはモックデータ（`mock-references.ts`）をフロントエンドでフィルタリング
- APIへのリクエストと並行して実行するため、表示が速い
- 既存の `CommandPalette.tsx` に約30行の変更で完成

---

### 機能② 記事詳細ページ サイドバーへの「関連Reference」表示

#### 完成イメージ

```
記事詳細ページ（右カラム）
┌─────────────────────────┐
│ 目次                     │  ← 既存
│  - セクション1           │
│  - セクション2           │
├─────────────────────────┤
│ 関連 Reference  ← NEW   │
│ ◇ 470                   │
│   艇種・中級             │
│ ◇ クローズホールド       │
│   技術・入門             │
└─────────────────────────┘
```

#### マッチングロジック

バックエンドAPIは不要。以下の情報だけで関連Referenceを特定できる：

1. **艇種タグ**（`article.boatType.slug`）→ 同名のReferenceを直接引く
2. **記事タグ**（`article.tags`）→ Referenceの`slug`と部分一致で検索

例：「470」の記事 → `slug: "470"` のReferenceを表示

#### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/app/articles/[slug]/page.tsx` | 右カラムに `RelatedReferences` コンポーネントを追加 |
| `frontend/src/components/RelatedReferences.tsx` | 新規作成：マッチングロジックと表示UI |

---

## 3. ファイル変更一覧

### 新規作成

| ファイル | 役割 |
|---------|------|
| `frontend/src/components/RelatedReferences.tsx` | 記事に関連するReferenceを表示するコンポーネント |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/components/CommandPalette.tsx` | Referenceのローカル検索追加、セクション別表示に変更 |
| `frontend/src/app/articles/[slug]/page.tsx` | 右カラムにRelatedReferencesを追加 |
| `frontend/src/app/globals.css` | コマンドパレットのセクションヘッダースタイル追加 |

---

## 4. 新しく登場する概念・技術

### useMemo（メモ化）

Referenceのローカル検索は、入力のたびに12件の配列をフィルタリングする。
件数が少ないので問題ないが、`useMemo` を使うと「前回と同じクエリなら再計算しない」最適化ができる。

```typescript
// useMemoの例（概念）
const localResults = useMemo(() => {
  return REFERENCES.filter(r => r.title.includes(query));
}, [query]); // queryが変わった時だけ再計算
```

`useEffect`が「副作用（APIコールなど）」を扱うのに対し、
`useMemo`は「計算結果のキャッシュ」を扱う。

---

## 5. 実装しないもの（今回対象外）

| 機能 | 理由 |
|------|------|
| Reference右カラムに関連Q&A表示 | バックエンドのDBスキーマ追加が必要。Phase 2c以降 |
| 本文中の用語の自動リンク化 | バックエンドのReferenceテーブルが必要。Phase 3以降 |

---

## 6. 実装順序

1. `CommandPalette.tsx` にReferenceローカル検索とセクション表示を追加
2. `RelatedReferences.tsx` コンポーネントを新規作成
3. `articles/[slug]/page.tsx` の右カラムに組み込み
4. `globals.css` にセクションヘッダーのスタイルを追加

---

**GOサインをいただければ実装を開始します。**
