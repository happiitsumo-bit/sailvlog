# Phase 2b-lite 企画書：ホーム画面刷新 "NAVIGATOR TERMINAL"

**バージョン:** 1.0（Phase 2b-lite — 認証なし・実データのみ）
**作成日:** 2026-05-20

---

## 1. 目的

現在の「更新記事の縦型リスト」を廃止し、**知識の俯瞰ができるダッシュボード**へ刷新する。
認証なし・実データのみで動く範囲に絞り、今すぐ動く状態を優先する。

---

## 2. 新レイアウト構造

```
┌─────────────┬────────────────────────────────────┬──────────────────┐
│  左サイドバー │         中央：Bento Dashboard      │  右：Telemetry   │
│  (既存維持)  │                                    │                  │
│             │  ┌──────────────────────────────┐  │  Team Ranking    │
│  Yachts     │  │  Pick Up Reference  (Large)  │  │  ─────────────── │
│  OP         │  │  今週の重要用語1件            │  │  #1 東大 18pts   │
│  420        │  └──────────────────────────────┘  │  #2 慶應 12pts   │
│  470        │  ┌──────────────┬───────────────┐  │  ...             │
│  Snipe      │  │ Unsolved Q&A │ Team Highlights│  │                  │
│  ...        │  │ 未解決質問   │ チーム最新動向 │  │  Active Q&A      │
│             │  │ 上位3件      │ 上位3チーム    │  │  未解決: N件     │
│             │  └──────────────┴───────────────┘  │  解決済み: N件   │
│             │                                    │                  │
│             │  Intelligence Feed                 │                  │
│             │  [REF] ポートスターボード... 2m     │                  │
│             │  [Q&A] 470のバングを...     5m     │                  │
│             │  [TEAM] 東大ヨット部が...   1h     │                  │
└─────────────┴────────────────────────────────────┴──────────────────┘
```

---

## 3. 各コンポーネントの仕様

### A. Pick Up Reference（Large タイル）
- `REFERENCES` 配列からランダムに1件表示
- タイトル・カテゴリ・summaryの冒頭80文字
- 「詳しく読む →」で `/reference/[slug]` へ遷移

### B. Unsolved Q&A（Small タイル）
- `GET /api/questions?filter=unanswered&limit=3` で未解決質問を取得
- 回答0件 or isAccepted=falseの質問
- タイトルのみ1行表示

### C. Team Highlights（Small タイル）
- `GET /api/teams` から記事数+Q&A数の合計が多い上位3チームを表示
- チーム名・カテゴリ・投稿数

### D. Intelligence Feed（1行ログ形式）
- 記事・質問・投稿（post）を時系列マージして表示
- タグ: `[ART]` `[Q&A]` `[POST]` `[TEAM]`（チームの記事）
- 各行: `[TAG] タイトル冒頭40文字 @author · Xm ago`
- 最大15件

### E. Team Power Ranking（右サイドバー）
- `GET /api/teams` から `articles + questions` の合計でソート
- 上位5チームを順位・名前・ポイントで表示

### F. Active Q&A Stats（右サイドバー）
- `GET /api/questions` から未解決数と解決済み数を表示

---

## 4. ファイル変更一覧

| 種別 | ファイル | 内容 |
|------|---------|------|
| 修正 | `frontend/src/app/page.tsx` | Bento Grid構造に全面刷新 |
| 新規 | `frontend/src/components/PickUpReference.tsx` | Referenceタイル |
| 新規 | `frontend/src/components/IntelligenceFeed.tsx` | 1行ログフィード |
| 修正 | `frontend/src/app/globals.css` | .bento-grid / .activity-log / .stat-widget 追加 |

---

## 5. スコープ外（Phase 3b以降）

- Skill Map（グラフ描画）
- ログインユーザーのパーソナライズ（My Team / My Fleet）
- Knowledge Coverage インジケーター（定義が必要）
