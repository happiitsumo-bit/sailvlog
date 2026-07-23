# Quality Gates — 5つの関所

<!-- このファイルはプロジェクトの docs/dev-org/ にコピーし、通過時に日付とサインを記録する -->
<!-- 原則: Gateを通らずに次工程へ進んではならない。Team Lead が通過を宣言し、①⑤は人間が承認する -->

## ① Product Gate — 「作る価値があるか」 【人間承認必須】

- 担当: product-lead が PRD を提出 → **人間が GO/NO-GO**
- 入力: PRD.md（Product Review 6観点 + 競合3つ + MVP定義済み）
- 通過条件:
  - [x] PRD.md の DoD が全て✅
  - [x] 人間が「これは自分が使う/語れる」と確認した
- 通過記録: 2026-07-23 / 判定: **GO（条件付き・選択肢(c)）** / 備考: rev.3で承認。主役体験は即決せず、**2週間の並行検証**（A=Googleフォームでカード運用、E2=練習2回のスマホGPS収録+既製ツールで反省会1回）の計測結果で確定する。両方PASS→E2主役+A接続 / E2のみFAIL→A主役 / 両方FAIL→PRDへ差し戻し。検証と並行してarchitectの技術検証（GPX再生エンジンのスパイク）は先行してよい。経緯: rev.1(A推奨)→オーナーFBで差し戻し→rev.2(公開データ調査でE1不成立判明)→rev.3(6案公平比較・E2推奨)。
- **S規模では省略可**（アイデア1段落をARCH.mdに書くことで代替）

## ② Architecture Gate — 「この設計で作り切れるか」

- 担当: architect が ARCH.md + TASKS.md（M/Lでは RESEARCH.md も）を提出 → Team Lead が判定
- 通過条件:
  - [ ] ARCH.md の DoD が全て✅
  - [ ] [M/L] RESEARCH.md: 全RQに判定（採用/不採用/保留+保留理由）と独立2ソース以上の根拠がある
  - [ ] [M/L] 「今回作る/将来作る/作らない」の3分類が RESEARCH.md にある
  - [ ] 情報源台帳がリンク集になっていない（各行に「適用方法」「そのまま採用できない点」が埋まっている）
  - [ ] [M/L] 実在性: `docs/dev-org/research/*.md` が researcher（Agentツール実起動）の成果物である — 下の通過記録に researcher 起動一覧（観点・担当RQ・起動日時）がある。Team Lead / architect の自作は不可
  - [ ] [M/L] Codex セカンドオピニオンレビュー実施済み — 指摘に対応 or 受容理由を記録した
  - [ ] 一番危ない技術リスクに検証プラン（または検証済み）がある
  - [ ] TASKS.md の Phase 1 が「動く最小版」に最短到達する並びになっている
  - [ ] 過剰設計チェック: 「まだ無い問題」のための構造が入っていない（YAGNI）
- 通過記録: {日付} / researcher起動一覧: 下記 / Codexレビュー: {実施日・指摘対応} / 備考:
  - researcher① 観点=再生エンジン/フロント（OSS実例・技術ブログ）担当RQ=01,02,04,12 → research/replay-engine.md（起動 2026-07-24）
  - researcher② 観点=データモデル/GPX処理（公式Doc・OSS）担当RQ=03,05,06,09,10 → research/data-model.md（起動 2026-07-24）
  - researcher③ 観点=基盤統合/ホスティング/収録（公式Doc・事例）担当RQ=07,08,11 → research/infra-recording.md（起動 2026-07-24）
  - SPIKE-01 実施: implementer起動（起動 2026-07-24、spike/ 隔離、RQ-01/02/03の実測材料）→ research/spike-replay.md

## ③ Quality Gate — 「出荷できる品質か」

- 担当: code-reviewer（REVIEW.md）+ qa-engineer（テスト結果）→ Team Lead が判定
- 通過条件:
  - [ ] REVIEW.md の Blocker が 0 件（Major は対応 or 明示的に受容の記録）
  - [ ] テストが存在し全てグリーン（実行ログ添付。「通るはず」は不可）
  - [ ] クリーン環境でセットアップ→起動が成功
- 通過記録: {日付} / テスト: {N件 pass} / 備考:

## ④ Demo Gate — 「人に見せられるか」

- 担当: ux-reviewer（UX-AUDIT.md）+ demo-director + docs-writer → Team Lead が判定
- 通過条件:
  - [ ] UX-AUDIT の Blocker が 0 件、First Run 監査が全て✅
  - [ ] README: 冒頭3秒で何かが分かる（1文 + デモGIF/スクショ）
  - [ ] デモ素材: GIF or 動画 or スクショ最低1点（実データでなくデモデータで見栄え確保）
  - [ ] 30秒で語れるデモストーリーがある（課題→操作→結果）
- 通過記録: {日付} / 素材: {パス} / 備考:

## ⑤ Release Gate — 「世に出してよいか」 【人間承認必須】

- 担当: release-manager が RELEASE.md を提出 → **人間が最終承認**
- 通過条件:
  - [ ] RELEASE.md のチェックリストが全て✅
  - [ ] 秘密情報の混入なしを確認済み
  - [ ] 人間が Release 本文と告知文を読んで承認した
- 通過記録: {日付} / URL: / 備考:

---

## Gate運用ルール

1. **FAILは正常動作。** Gateで止まるのはコストでなく、後工程の手戻り（より高いコスト）の回避
2. Gate通過の判定根拠は必ずファイルに残す（「良さそうだから通した」は禁止）
3. 同じGateで2回FAILしたら、修正でなく前工程の成果物（PRD/ARCH）を疑う（解く層の確認）
4. 締切が迫った場合に緩めてよいのは③の Minor と④の素材点数のみ。①⑤は絶対に省略しない
