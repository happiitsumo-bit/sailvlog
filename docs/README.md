# docs/ の地図

## dev-org/ — 現行v3開発の正本（アクティブ）

v3「反省会リプレイ・デバッガ」のdev-org契約ファイル一式。**開発状態を知りたければここだけ読めばよい。**

| ファイル | 役割 |
|---|---|
| `PRD.md` | 企画書（rev.3・①Gate通過済み）。何を作るか・作らないかの正本 |
| `PRD-rev4-sharing-layer.md` | 知の共有層の追加提案ドラフト（オーナーレビュー待ち） |
| `RESEARCH.md` | 設計判断12件（RQ）の調査統合とSPIKE-01結果 |
| `research/` | researcher一次調査メモ4本（RESEARCH.mdの根拠） |
| `ARCH.md` | 技術設計（ADR6本・データモデル・API仕様）。②Gate通過済み |
| `TASKS.md` | 実装タスク（S0〜S3）と進捗チェックボックス。**現在の進捗の正本** |
| `GATES.md` | 5つの関所の通過記録（判定根拠つき） |
| `VALIDATION.md` | 2週間並行検証キット（B-1解除により並走参考化） |
| `TEST-PLAN.md` | テスト戦略（qa-engineer作成） |
| `FLOWS.md` | イベントフロー図・画面遷移図（企画レビュー用） |
| `reports/` | 毎朝のルーティンが書く日次進捗レポート |

## trimlab/ — 並走プロジェクト（休眠中）

セールトリム物理シミュレータの企画資料。v3のコア外だがオーナーが継続意思を表明しているため、アーカイブせず保持。実装は現在なし（旧コードは `frontend/src/components/TrimSimulator.tsx.bak`）。

## archive/v1/ — v1時代の資料（完了・凍結）

v1（ナレッジシェアSNS時代）の企画書・監査レポート・デザイン資料。歴史的記録として保持。**現行開発では参照不要**（PRD/RESEARCHからの引用は歴史的経緯の出典として残る）。

- `critic-report*.md` / `research-report.md` — v1の自己批判・調査レポート（v3ピボットの起点になった資料）
- `roadmap-vision.md` — v1のロードマップ（「フィードは知の蓄積に寄与しない」の出典）
- `security-report.md` — v1の自主セキュリティ監査（XSS発見・修正の記録。就活の実績資料）
- `phase*.md` / `*-spec.md` / `ux-refinement.md` / `step1_setup.md` — v1の実装計画書群
- `design_bundle/` / `demo-3-swiss.html` — v1のデザインシステム資産
