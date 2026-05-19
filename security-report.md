# sailvlog フロントエンド セキュリティ監査レポート

**実施日**: 2026-05-19  
**対象**: `frontend/src` 以下の主要ページ・ライブラリ  
**担当**: security-agent

---

## 監査対象ファイル一覧

| ファイル | 役割 |
|---------|------|
| `lib/api.ts` | API クライアント共通処理 |
| `lib/auth.ts` | 認証状態管理 |
| `app/articles/new/page.tsx` | 記事投稿フォーム |
| `app/articles/[slug]/page.tsx` | 記事詳細（Markdown レンダリング） |
| `app/questions/new/page.tsx` | 質問投稿フォーム |
| `app/feed/page.tsx` | タイムライン（投稿フォーム付き） |
| `app/users/[username]/edit/page.tsx` | プロフィール編集 |
| `app/login/page.tsx` | ログインフォーム |
| `app/register/page.tsx` | 新規登録フォーム |

---

## 発見した問題と対応状況

### [修正済み] XSS リスク: ReactMarkdown の javascript: スキーム

**ファイル**: `app/articles/[slug]/page.tsx`  
**深刻度**: 中  
**問題**:  
`ReactMarkdown` + `remark-gfm` を使用しており、Markdown 内に `[click](javascript:alert(1))` のようなリンクが含まれていた場合、デフォルトでは `javascript:` スキームのリンクがそのまま出力される可能性があった。

**対応**:  
`urlTransform` プロパティで `javascript:` スキームを検出し、空文字に変換するガードを追加。

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  urlTransform={(url) => {
    if (/^javascript:/i.test(url)) return "";
    return url;
  }}
>
```

---

### [修正済み] 認証フロー: EditProfile ページの isLoggedIn() チェック漏れ

**ファイル**: `app/users/[username]/edit/page.tsx`  
**深刻度**: 低〜中  
**問題**:  
明示的な `isLoggedIn()` チェックがなく、API の 401 エラーでリダイレクトされるまでの間、フォームが一瞬レンダリングされる可能性があった。

**対応**:  
`isLoggedIn` を import し、`useEffect` の先頭で即座にリダイレクトするガードを追加。

```tsx
useEffect(() => {
  if (!isLoggedIn()) {
    router.push("/login");
    return;
  }
  // ... API 呼び出し
}, [router, username]);
```

---

### [修正済み] 認証フロー: Feed ページで非ログイン時に投稿フォームが見えてしまう

**ファイル**: `app/feed/page.tsx`  
**深刻度**: 低  
**問題**:  
`/feed` ページは認証チェックなしで投稿フォームが全員に表示されていた。送信時は API が 401 を返すため実際の投稿はできないが、UX およびセキュリティの観点から非ログインユーザーにはフォームを見せるべきではない。

**対応**:  
`isLoggedIn()` の結果で条件分岐し、未ログイン時はログインへ誘導するメッセージを表示するよう変更。

---

### [修正済み] フォームバリデーション: 記事投稿の最大文字数チェック漏れ

**ファイル**: `app/articles/new/page.tsx`  
**深刻度**: 低  
**問題**:  
タイトル・本文に最大文字数の制限がなく、意図的に大きなペイロードを送り込める状態だった（DoS 的な使い方の余地がある）。

**対応**:  
`handleSubmit` 内に上限チェックを追加。

- タイトル: 200文字以内
- 本文: 50,000文字以内

---

### [修正済み] フォームバリデーション: 質問投稿の最大文字数チェック漏れ

**ファイル**: `app/questions/new/page.tsx`  
**深刻度**: 低  
**問題**:  
記事投稿ページと同様、タイトル・本文に最大文字数の制限がなかった。

**対応**:  
`handleSubmit` 内に上限チェックを追加。

- タイトル: 200文字以内
- 本文: 20,000文字以内

---

## 問題なし（確認済み）

| 観点 | 状況 |
|------|------|
| `dangerouslySetInnerHTML` の使用 | 全ファイルで使用なし。安全。 |
| Feed の投稿本文表示 `{p.body}` | React のデフォルト文字列エスケープが効いており XSS なし。 |
| ログインページのエラー表示 | `{error}` をテキストノードとして表示。安全。 |
| 記事詳細の `API_URL` | サーバーコンポーネントで `process.env.API_URL`（NEXT_PUBLIC_ なし）を使用。正しい設計。 |
| トークンの 401 自動クリア | `api.ts` で 401 時に `localStorage` をクリアし `/login` へリダイレクト。正しい実装。 |
| 新規登録フォームのバリデーション | `minLength={3}` `maxLength={50}` `minLength={8}` が適切に設定済み。 |
| 記事投稿の認証チェック | `isLoggedIn()` チェックあり。 |
| 質問投稿の認証チェック | `isLoggedIn()` チェックあり。 |

---

## 残課題（フロントエンドの範囲外）

| 課題 | 説明 |
|------|------|
| バックエンドのエラーメッセージ | `api.ts` は `body.error` をそのまま UI に表示する。バックエンドが詳細すぎる内部エラーを返さないよう、バックエンド側でエラーレスポンスを統一することが望ましい。 |
| Markdown サニタイズの強化 | `rehype-sanitize` パッケージを導入すると、HTML タグの混入（`<script>` 等）もより堅牢にブロックできる。現状は `javascript:` スキームのみをガード済み。 |
| CSP（Content Security Policy）ヘッダー | `next.config.js` で CSP を設定すると XSS の多くのベクタを追加でブロックできる。 |

---

## 修正ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `app/articles/[slug]/page.tsx` | `urlTransform` で `javascript:` スキームをブロック |
| `app/articles/new/page.tsx` | タイトル 200 文字・本文 50,000 文字の上限チェック追加 |
| `app/questions/new/page.tsx` | タイトル 200 文字・本文 20,000 文字の上限チェック追加 |
| `app/users/[username]/edit/page.tsx` | `isLoggedIn` import・`useEffect` 先頭に認証ガード追加 |
| `app/feed/page.tsx` | `isLoggedIn` import・非ログイン時にフォームを非表示化 |
