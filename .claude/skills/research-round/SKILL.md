---
name: research-round
description: sailvlog で設計判断のための調査を回すときの手順。何を本体（Team Lead・architect）が自分で調べ、何を researcher に並列で任せるかを決め、同じ調査の二重起動を防ぐ。RQ（設計判断の問い）を立てた・Architecture Gate の材料を集める・技術や市場を比べたいときに使う。「調べて」「RQ を調査して」「research を回して」「比較して」と言われたとき。
---

# research-round — 本体で調べる所と、researcher に任せる所

researcher を起こすのは、互いに独立した観点の Web 調査を並列で回すときだけ。リポジトリの下調べと、結果を後で本体が使う読み物は本体がやる（2026-10-26。Anthropic の 2026-10-22 の記事。knowledge `note:anthropic-subagent-guidance-2026`）。過去に同じ 10 テーマの調査を 2 回起動した跡があるので、起動の前に既存の調査を確かめる。

## 1. 先に確かめる（本体）

1. `docs/dev-org/RESEARCH.md` の RQ 表で、その問いの status と担当観点
2. `docs/dev-org/research/*.md` に同じ観点の調査があるか（`grep -l <キーワード> docs/dev-org/research/*.md`）。あれば読み、足りない所だけを問いにする
3. knowledge: `python3 ~/workspace/knowledge/scripts/ctx.py find <言葉>`
4. この会話でもう researcher を起こしていないか。起こしていれば、新しく起こさず SendMessage で続きを頼む

## 2. 分ける

| 調べる中身 | 誰が | 理由 |
|---|---|---|
| このリポジトリのコード・画面の流れ・既存の ADR | 本体 | 設計で本体がそのまま使う。任せると読み直しになる |
| 1 つの RQ の追加確認・公式ドキュメント 1〜2 本で決着するもの | 本体 | 起動と引き継ぎの費用のほうが大きい |
| S 規模の作業 | 本体 | GATES ② の RESEARCH.md・実在性は M/L だけの条件 |
| M/L 規模で、観点が互いに独立した Web 調査（例：再生エンジン／データモデル／基盤） | researcher を観点ごとに並列 | 独立した並列作業。GATES ② の「実在性」（researcher の起動一覧）もこれで満たす |

並列にするのは観点が本当に別のときだけ。同じ RQ を 2 人に分けない。

## 3. researcher に渡すもの

- 担当 RQ の ID と問い（択一の候補つき）、決めたいこと
- 既に分かっていること（1 で読んだ既存の調査のパス）。調べ直させない
- 出力先 `docs/dev-org/research/<観点>.md` と形式（RESEARCH-NOTE のテンプレート）
- 検索回数の上限

起動したら GATES の通過記録に、観点・担当 RQ・起動日時を書く（Team Lead）。

## 4. まとめる（本体）

architect が `research/*.md` を読み、`RESEARCH.md` の判定（採用／不採用／保留）を書く。調べて分かった道具・サービスの事実は knowledge の正本カードにも書く（`~/workspace/knowledge/AGENTS.md`）。
