# CODEX BRIEF — セカンドオピニオン・コード監査（読み取り専用）

作成日: 2026-08-02 / 依頼者: Team Lead / 対象ブランチ: `v3/replay-mvp`

## 0. 最重要ルール

- **読み取り専用。ファイルを一切変更しない。`git commit` / `git push` を絶対にしない。**
- 出力は `docs/dev-org/REVIEW-codex.md` **1ファイルのみ** 新規作成してよい（これだけが例外）。
- **リポジトリは PUBLIC（github.com/happiitsumo-bit/sailvlog）。** 接続文字列・トークン・実在の人名を成果物に書かない。
- **`export DATABASE_URL` を絶対にしない**（`.env.test` は既存の環境変数を上書きしないため、同じシェルで `npm test` を打つと本番DBが TRUNCATE される）。
- **DBに接続する操作をしない**（`prisma migrate` / `prisma db push` / `npm test`（backend）は実行禁止）。

## 1. 対象範囲

リポジトリ: `/Users/nova/workspace/dev/sailvlog`

- `backend/src/**`（Express + Prisma。認証・認可・チーム・セッション・トラック・公開昇格）
- `frontend/src/**`（Next.js 14 App Router。リプレイエンジン・公開ページ・ホーム）
- `backend/prisma/schema.prisma` とマイグレーション群
- 設計の正本: `docs/dev-org/PRD.md` / `ARCH.md`（ADR-001〜017）/ `AGENTS.md`（リポジトリ直下）

## 2. 見てほしい観点（優先度順）

1. **セキュリティ／認可**
   - 公開レスポンスがホワイトリスト方式になっているか（部員の実名・email・内部IDが漏れていないか）
   - 非メンバーがチームの中身（名簿・セッション・注釈）に到達できる経路がないか
   - `INTERNAL_PROXY_SECRET` / `JWT_SECRET` の取り扱い。`NEXT_PUBLIC_` 接頭辞の秘密が無いか
   - IDOR（他人の `sessionId` / `trackId` を指定して読み書きできるか）
2. **正しさ（バグ）**
   - GPX パース・時刻正規化（`frontend/src/lib/gpx/parse.ts` の `computeSessionStart` / `startSec`）
   - Canvas リプレイの再生位置・複数艇同期
   - 非同期処理の取りこぼし、未 await、エラー握り潰し
3. **設計逸脱**
   - ARCH.md の ADR と実装の乖離（特に ADR-010 秘密の扱い、ADR-013/014 チーム公開範囲）
   - PRD §5 の禁止事項に抵触する実装
4. **保守性・YAGNI 違反**（優先度低。指摘は具体的な行に紐づけること）

## 3. 成果物

`docs/dev-org/REVIEW-codex.md` に以下の形式で。

各指摘は必ず:
- **深刻度**: High / Medium / Low
- **場所**: `path/to/file.ts:123`（行番号必須）
- **事象**: 何が起きるか（1〜2文）
- **再現/根拠**: どの入力・どの状態でそうなるか。**コードを読んだ結果の推測なら「未検証」と明記する**
- **提案**: 直し方（実装はしない）

末尾に「確認したが問題なかった領域」も列挙すること（カバレッジの証跡）。

## 4. 受け入れ基準

- High/Medium の指摘に行番号と根拠がある
- 推測と検証済みが区別されている
- ファイルを変更していない（`git status` が BRIEF 実行前と同じ ?? 9件のみ）

## 5. 検証記録（Team Lead が埋める）

- 検証者:
- 検証日:
- 結果:
