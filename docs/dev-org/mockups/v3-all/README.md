# sailvlog v3 — 全画面モック

`index.html` を起点に、Phase 1で作る全画面と主要状態を横断確認するためのモックです。

## 含まれる画面

- ログイン
- 新規登録
- セッション一覧
- GPX取込
- 部内リプレイ
- 公開昇格ダイアログ
- 公開リプレイ
- 収録ハンドブック
- 権限エラー（403）
- 公開URLの404
- 画面遷移図

## 位置づけ

- 画面仕様の正本: `docs/dev-org/UI-DESIGN.md`
- デザインの正本: `design-system/`
- 公開昇格仕様: `docs/dev-org/SPEC-share1-phase1.md`
- このモック: 実装前の全体レビューと画面間の一貫性確認用

既存の `replay.html` / `sessions-list.html` / `upload.html` は検証済みアーカイブとして変更せず、このディレクトリを全画面版として追加しています。
