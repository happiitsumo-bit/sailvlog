# AGENTS.md — sailvlog で作業する全エージェントへの常設指示

このファイルは Codex を含む全コーディングエージェントが最初に読む契約書である。
**ここに書かれていない制約は守られない**前提で書かれている（過去2回、書き忘れが事故になった）。

## このプロジェクトは何か

**sailvlog v3 = 「反省会リプレイ・デバッガ」。** ヨット部の練習をGPXで取り込み、
複数艇を同時に再生し、注釈を付けて部内・部外に共有するWebアプリ。
v1の「機能寄せ集めSNS」からピボット済みで、**v2機能（記事/Q&A/フォロー等）は410で凍結されている**。

## 正本の場所（迷ったらここを読む。推測で書かない）

| 内容 | 正本 |
|---|---|
| 何を作るか・作らないか | `docs/dev-org/PRD.md`（§5が禁止事項）、`docs/dev-org/PRD-rev8-home-experience.md` |
| 設計・ADR | `docs/dev-org/ARCH.md` |
| タスクの分解と検証記録 | `docs/dev-org/TASKS.md`（履歴）／**新規タスクは GitHub Issue が正本** |
| 画面・UI | `docs/dev-org/UI-DESIGN.md` |
| 色・間隔などのトークン | `design-system/theme.json` |
| Gateの判定と根拠 | `docs/dev-org/GATES.md` |
| 分業の体制 | `docs/dev-org/PROCESS-routine-claude-codex.md` |

## 交渉不可の制約

1. **新規npm依存の追加は Team Lead 承認制**（ARCH §1・ADR-011）。無断追加でbackendが起動不能になった事故がある
2. **色・間隔は `design-system/theme.json` から取る。ハードコード禁止**（ADR-008）
3. **秘密情報に `NEXT_PUBLIC_` を付けない**（ADR-010）。クライアントJSに焼き込まれる
4. **未認証で読めるレスポンスは「含めるものだけを列挙」する**（ADR-007）。`select` 無しの `findMany`/`create`/`update` をそのまま返さない。同型の漏洩を3回起こしている（`publicViewCount`・`inviteCode`）
5. **製品コードの変更にはテストを同梱する**（GATES ③の通過条件・`deliverables.md`）
6. **backendテストで `request(app)` を使わない。`helpers/testServer.ts` を使う**（サーバ生成レースで低頻度404になる）
7. **PRD §5「明示的に入れない」（自動解析・3D再生・LIVE・動画・ゲーミフィケーション）は提案もしない**
8. **`docs/dev-org/` の正本を書き換えない。** 気づきは報告する（正本を書くのは1本に限定＝`parallel-dev.md`）
9. **`git commit` しない。** コミットは Team Lead が検証後に行う

## 検証コマンドとベースライン（下回ったら未完成）

同時に2つ走らせるとテストDBのTRUNCATEが衝突して壊れる。**単独で実行する。**

```
# backend（要: docker compose up -d db）
cd backend && npx tsc --noEmit        # エラー 0
cd backend && npx jest --runInBand    # 16 suites / 154 passed
cd backend && npm run build           # 成功

# frontend
cd frontend && npx tsc --noEmit       # エラー 0
cd frontend && npx vitest run         # 7 files / 59 passed
cd frontend && npm run build          # 成功
```

ベースライン更新日: 2026-08-01（Team Lead 実測）

## 危険操作（実行前に必ず止まる）

- **`DATABASE_URL` を `export` しない。** コマンド単位で渡す（`DATABASE_URL="..." npx prisma migrate deploy`）。
  `.env.test` はシェルの既存環境変数を上書きしないため、同じシェルで `npm test` を叩くと**本番DBが全テーブルTRUNCATEされる**
- 本番（Neon/Render/Vercel）への操作は Team Lead 経由
- `JWT_SECRET` の変更は発行済みJWT（有効期限2h）を全て無効化する。反省会当日に触らない

## 報告の形式

「やっておきました」で終わらせない。**コマンドと実測出力を貼る。未検証なら「未検証」と書く。**
落ちたテストは落ちたと報告する。隠すと Team Lead の再実測で必ず露見する。
