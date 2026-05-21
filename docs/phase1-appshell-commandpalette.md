# Phase 1 実装企画書
## 3カラムAppShell + Ctrl+K コマンドパレット

**バージョン:** 1.0  
**作成日:** 2026-05-20

---

## 1. 目的

現在のsailvlogはモバイル中心のレイアウトで、PCの広い画面を活用できていない。  
本フェーズでは「PCで使い込める道具」としての土台を整備する。具体的には：

- **PCでのナビゲーション効率を上げる**（左固定サイドバー）
- **「探す」ストレスをゼロにする**（Ctrl+K コマンドパレット）

---

## 2. 完成イメージ

### PC（1280px以上）
```
┌──────────────────────────────────────────────────────┐
│ TopBar（ロゴ + 検索バー + Write/Login ボタン）         │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  左サイド  │      メインコンテンツ                    │
│  バー      │      （既存のページがそのまま表示）       │
│            │                                         │
│  ⌂ Home   │                                         │
│  ◈ Feed   │                                         │
│  ? Q&A    │                                         │
│  ▶ Learn  │                                         │
│  ◉ Sailors│                                         │
│  ─────    │                                         │
│  Classes  │                                         │
│  470      │                                         │
│  ILCA     │                                         │
│  ...      │                                         │
│            │                                         │
│  @username │                                         │
└────────────┴─────────────────────────────────────────┘
```

### モバイル（767px以下）
- 左サイドバーは**非表示**
- 既存の `BottomTabBar` が引き続き機能する（変更なし）

---

## 3. 実装する機能の一覧

### 機能① AppShell の3カラム対応

| 項目 | 内容 |
|------|------|
| PC時 | 左サイドバーを**常時表示**（固定幅240px） |
| タブレット時（768〜1279px） | 左サイドバーを**アイコンのみ表示**（幅64px） |
| モバイル時（〜767px） | 左サイドバーを**非表示**、BottomTabBarを表示 |

アクティブなページは左サイドバーでテラコッタ色のインジケーターで強調。

### 機能② Ctrl+K コマンドパレット

| 項目 | 内容 |
|------|------|
| 起動方法 | `Ctrl+K`（Windows）/`Cmd+K`（Mac）、または TopBar 検索バーをクリック |
| 表示内容 | 記事・質問・ユーザーの横断検索結果（APIから取得） |
| 操作 | キーボードの`↑``↓`で選択、`Enter`で遷移、`Esc`で閉じる |
| デザイン | 画面中央にモーダル表示、既存の`--paper`/`--fg`/`--terra`変数を使用 |

### 機能③ キーボードショートカット（最小限）

| ショートカット | 動作 |
|--------------|------|
| `Ctrl/Cmd + K` | コマンドパレットを開く |
| `Esc` | コマンドパレットを閉じる |
| `↑` / `↓` | パレット内の候補を移動 |

---

## 4. ファイル変更一覧

### 新規作成

| ファイル | 役割 |
|---------|------|
| `frontend/src/components/CommandPalette.tsx` | コマンドパレットのUIコンポーネント（検索モーダル） |
| `frontend/src/components/CommandPaletteProvider.tsx` | `Ctrl+K`のキーボードイベントと開閉状態を管理するContext |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/app/layout.tsx` | `CommandPaletteProvider` を追加でラップする |
| `frontend/src/components/TopBar.tsx` | 検索バーをクリックでパレットを開くように変更 |
| `frontend/src/components/ClassSidebar.tsx` | タブレット対応（アイコンのみ表示）のCSSクラスを追加 |
| `frontend/src/app/globals.css` | コマンドパレットのスタイル、サイドバーのレスポンシブ対応を追加 |

---

## 5. 新しく登場する概念・技術

### React Context（コンテキスト）
コンポーネントをまたいで状態を共有する仕組み。  
今回は「パレットが開いているか（`isOpen`）」という状態を、`TopBar`（クリックで開く）と`CommandPalette`（表示・非表示）の両方が参照できるようにするために使う。

```
CommandPaletteProvider（isOpenを管理）
  ├── TopBar（クリック → setIsOpen(true)）
  └── CommandPalette（isOpenがtrueのとき表示される）
```

`useState` が1コンポーネント内の状態管理なのに対し、`useContext` は**複数コンポーネント間で状態を共有**するイメージ。

### `useEffect` + `addEventListener`（キーボードイベント）
`Ctrl+K` の検知は「ブラウザ全体のキー入力を監視する」処理。  
Reactでは `useEffect` の中で `document.addEventListener('keydown', ...)` を登録し、コンポーネントが消えるときに `removeEventListener` で解除する（メモリリーク防止）。

---

## 6. 変更しないもの

- 既存の各ページ（`page.tsx`）のコンテンツは**一切触らない**
- `BottomTabBar`（モバイル用）は現状維持
- `Navbar.tsx`（現在未使用のコンポーネント）はそのまま放置

---

## 7. 実装順序

1. `globals.css` にコマンドパレットとサイドバーレスポンシブのCSS追加
2. `CommandPaletteProvider.tsx` 作成（状態管理・キーボードイベント）
3. `CommandPalette.tsx` 作成（検索UI）
4. `layout.tsx` に Provider を追加
5. `TopBar.tsx` の検索バーをパレット起動トリガーに変更
6. `ClassSidebar.tsx` にタブレット時のアイコンのみ表示を追加

---

## 8. この企画書でカバーしないもの（Phase 2以降）

- 右カラム Contextual Sidebar（関連記事・人気タグ）
- 艇種チップフィルター
- Markdownエディタ

---

**GOサインをいただければ実装に入ります。**
