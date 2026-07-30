# PROCESS — spec-kit（Spec-Driven Development）のdev-org取り込み記録

- 日付: 2026-07-24 / 作業: architect（オーナー指示「設計についてのプロセスを取り入れよ」）
- 対象: GitHub spec-kit の constitution / specify / clarify / plan / tasks / analyze / implement 各フェーズとテンプレート群
- 適用先: `~/workspace/system/claude-config`（dev-orgテンプレート+SKILL.md）— コミット `1a50639`
- 根拠データ: 本プロジェクト（sailvlog）の実運用。PRD rev.1→rev.3 の差し戻し2回、Codexセカンドオピニオンレビュー15指摘（うち「PRDとTASKSのPhase語義衝突」「B-1サブゲート条件のタスク未反映」）

## 1. 分析サマリ

spec-kit の中核は「仕様を実行可能な一次成果物にする」ための3つの規律で、いずれも**エラーの前倒し検出**に効く:

1. **曖昧さの明示化** — 仕様が指定しないことをLLMが推測で埋めることを禁止し、`[NEEDS CLARIFICATION: 問い]` として構造的に残す。/clarify 工程（最大5問・択一形式）で解消し、Clarifications セッションログに Q→A を記録
2. **IDによるトレーサビリティ** — FR-001/SC-001 形式の要件IDと、タスクの [Story] ラベルで「要件→タスク」の対応を機械的に照合可能にする
3. **実装前の横断整合性チェック（/analyze）** — spec/plan/tasks の3文書を、定型の検出分類（重複・曖昧・過少仕様・カバレッジギャップ・用語ドリフト・憲法違反）+深刻度で読み取り専用監査する

一方、dev-org が既に spec-kit より強い領域: 役割分離（作る人と評価する人の別人格化。spec-kit は単一エージェント前提で自己レビュー）、Gate①⑤の人間承認、エビデンス駆動Research（RQ択一・独立2ソース・実在性証跡）、Codexセカンドオピニオン、デモ品質工程、knowledge還流。これらは後退させない。

**sailvlog実データとの紐づけ**: 今回Codexレビューが終盤で発見した「Phase語義衝突」= 用語ドリフト、「B-1すり抜け」= カバレッジギャップは、spec-kit の /analyze がまさに定型検出する類型。dev-org では検出が Codex の自由記述レビューの観察力に依存していた（=運任せ）。また PRD rev.1→rev.3 の差し戻し2回の一部は「推測で埋めた仮定の後出し発覚」で、マーカー規律があれば Gate① 前に表面化していた。

## 2. マッピング表

### 両方にあるが形が違う

| spec-kit | dev-org対応物 | 差分と判断 |
|---|---|---|
| /specify + spec-template（US優先度・Given/When/Then・FR/SC ID） | product-lead + PRD.md（6観点評価・競合3・入れないリスト） | dev-orgは「作る価値」判断が強く、spec-kitは要件の構造化が強い。**F-ID を採用** |
| /plan + plan-template（Technical Context・Constitution Check・Complexity Tracking） | architect + ARCH.md（ADR・リスク・縮退プラン） | ADRの方がトレードオフ記録として濃い。Complexity Tracking は保留（§5） |
| plan Phase 0 research.md | RESEARCH.md + researcher並列（RQ択一・独立2ソース・打ち切り条件） | dev-orgが明確に強い。採用なし |
| /tasks + tasks-template（[Story]ラベル・[P]並列・Checkpoint） | TASKS.md（縦切りPhase1貫通・検証欄・依存） | 縦切り原則は同等。**[Story]ラベル相当の「対応要件: F-XX」を採用** |
| /analyze（検出分類・深刻度・カバレッジ表・読み取り専用） | Codexセカンドオピニオンレビュー（SKILL.md Research工程 step4） | 実施タイミングは同じ（実装前）だが、dev-orgは観点が自由記述寄り。**検出観点の定型化を採用** |
| constitution（プロジェクト憲法+各工程での準拠チェック） | 組織憲法 = engineering-mindset.md + GATES.md + agents定義 | dev-orgは「組織レベル」憲法のみで「プロジェクトレベル」不変原則の置き場がない。独立ファイル新設は保留（§5） |
| /implement（tasks順実行・checkpoint検証） | implementer + TASKS実装ルール | 同等。採用なし |
| checklist-template + /checklist | 各テンプレDoD + GATES.md 通過条件 | 機能重複。不採用（YAGNI） |

### spec-kit側にしかないもの

| 要素 | 判断 |
|---|---|
| `[NEEDS CLARIFICATION]` マーカー + Clarifications セッションログ | **採用（軽量版）** |
| /clarify 対話工程（最大5問・択一・カバレッジ分類法での走査） | 工程としては保留（§5）。マーカー+DoDのみ導入 |
| Constitution Check ゲート + Complexity Tracking 表 | 保留（§5） |
| Red-first（テストが失敗することを確認してから実装） | 保留（§5） |
| feature番号+ブランチ自動生成 / extensions hooks / contracts・data-model分割ファイル | 不採用（ツール依存・YAGNI。dev-orgはファイル契約で代替済み） |

### dev-org側にしかないもの（守った強み）

役割分離（実装と評価の別人格）/ Gate①⑤人間承認 / エビデンス駆動Research（独立2ソース・researcher実起動の実在性証跡）/ Codexセカンドオピニオン / ux-reviewer・demo-director のデモ品質工程 / knowledge還流（/til・decisions）/ 規模プロファイルS/M/L。今回の変更はすべて追記型で、これらの構造には触れていない。

## 3. 適用した変更一覧（claude-config コミット `1a50639`）

| ファイル | 変更要旨 |
|---|---|
| `dev-org/templates/PRD.md` | 冒頭コメントに「推測で埋めない・`[NEEDS CLARIFICATION]` 起票」ルール / MVP機能を F-01 形式のID付きに / 新設「7. Clarifications（曖昧点の解消ログ）」（Q→A表・改訂経緯） / DoDに「F-ID付与」「マーカー0件（保留は人間裁定）」追加 |
| `dev-org/templates/ARCH.md` | DoDに「PRDの未解消マーカーを設計側の推測で埋めない」「カバレッジ表で全F-IDにタスク対応」追加 |
| `dev-org/templates/TASKS.md` | 冒頭コメントに用語統一ルール（Phase等の同名別義禁止・ずれは上流を直す） / タスク書式に「対応要件: F-XX」 / 新設「要件カバレッジ表」（ゼロ対応=Gate② FAIL事由） |
| `dev-org/templates/GATES.md` | Gate①通過条件に「マーカー0件」 / Gate②通過条件に「整合性チェック: (a)要件カバレッジ (b)用語ドリフト (c)3文書間矛盾。M/LはCodexレビュー必須観点、SはTeam Lead自己確認」 |
| `skills/dev-org/SKILL.md` | CodexセカンドオピニオンレビューにPRD.mdを入力追加 + 整合性チェック観点（F-IDカバレッジ=ゼロ対応はHigh・用語ドリフト・マーカー残存）を必須化 |

各採用の根拠→sailvlog実データ対応: F-ID+カバレッジ表 ← B-1すり抜け / 用語統一+ドリフト検出 ← Phase語義衝突 / マーカー+Clarificationsログ ← PRD差し戻し2回とGATES備考にしか残らなかった改訂経緯。

## 4. sailvlogへの適用（本プロジェクト）

進行中の文書（PRD rev.3 / TASKS）への遡及的なF-ID振り直しは行わない（実装フェーズ進行中の文書改訂はコスト>効果）。PRD-rev4-sharing-layer.md 以降の改訂・次イテレーション（②再入場）から新テンプレート規律を適用する。

## 5. オーナー判断待ちリスト（運用コストが上がるため未適用）

1. **プロジェクト憲法ファイル（CONSTITUTION.md相当）の新設** — プロジェクト固有の不変原則（例: 本件の「デプロイはオーナー同席」「①⑤人間承認維持」）は現状GATES備考に散在。独立ファイル+各Gateでの準拠チェックにすると追跡性が上がるが、文書1枚+チェック工程が全プロジェクトに増える
2. **/clarify 相当の対話工程の正式化** — Gate①前に「最大5問・択一・推奨案提示」の定型質問ループを工程として固定するか。現状はproduct-leadの通常対話+マーカーで軽量代替
3. **Red-first の義務化** — 「テストを先に書き、落ちることを確認してから実装」をTASKSの順序規則にするか。qa-engineer並走・deliverables.md（最低1本）との整合整理が必要
4. **ARCH.md への Complexity Tracking 表** — YAGNI違反を意図的に許す場合の正当化表（違反/必要理由/却下した単純案）。ADRの「受け入れるデメリット」欄と重複気味であり、追加するなら統合形で
5. **checklist-template の導入** — 観点別受け入れチェックリストの独立ファイル群。DoD+GATESと機能重複のため不採用を提案（確認のみ）
