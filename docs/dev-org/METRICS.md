# METRICS — sailvlog v3 成功指標の計測（T-92）

**責務**: Phase 1（MVP：自部、8週間）の成功指標①～③を定義し、SQLで計測可能にする。

**実装者**: T-92 / release-manager  
**状態**: 初版（2026-07-26）  
**検証**: ローカル PostgreSQL で実行確認済み（Neon デプロイは B-3 ブロック待ち）

---

## Overview

PRD §6「成功の定義」から、以下の3つの指標をSQLで計測する。

| 指標 | 定義 | 計測方法 | 基準 |
|---|---|---|---|
| **①** | 練習・レース日の60%以上で収録→アップロード成立 | **SQL：分子のみ出力**（Sessionテーブルのレコード数）。**分母は部内記録の練習・レース実施日数**。率は `total_sessions ÷ 実施日数` で手計算 | 60%以上 |
| **②** | 反省会でのリプレイ使用が月4回以上 | **正式：部内記録で「実施日・対象セッション」を記録**。SQL参考値：注釈が作られた日ごとのセッション数（ただし注釈がない反省会は記録されないため、SQLの数値は下限値に過ぎない） | 月4回以上（部内記録から確定） |
| **③** | 注釈が累計30件以上 | Annotation テーブルのレコード総数 | 累計30件以上 |

---

## 指標①：アップロード数（セッション数）

### 定義
**「練習・レース日の60%以上で収録→アップロード成立」**

この指標は**分子（セッション数）** = SQLで計測、**分母（実施日数）** = 部内記録で管理し、率は手計算で確定する設計。

セッションの作成 = GPX ファイルのアップロード成功。SQLで出力される数値：
- **total_sessions**: 期間内の総セッション数
- **practice_sessions / race_sessions**: 種別ごとの内訳

### SQL
```sql
SELECT 
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE type = 'practice') as practice_sessions,
  COUNT(*) FILTER (WHERE type = 'race') as race_sessions
FROM "Session"
WHERE "teamId" = 1
  AND "startedAt" >= '2026-<PHASE_1_START_DATE>'  -- Phase 1 開始日（実装時に記入）
  AND "startedAt" < '2026-<PHASE_1_END_DATE>';    -- Phase 1 終了日（実装時に記入）
```

### 実行例（2026-07-26）
```
 total_sessions | practice_sessions | race_sessions
----------------+-------------------+---------------
              1 |                 1 |             0
(1 row)
```

### 読み方と率の計算
- SQL出力値: total_sessions = **1** （分子）
- 部内記録: Phase 1 実施日数 = **N日** （分母。スプレッドシートで管理）
- **達成率 = 1 ÷ N × 100%**
- **指標達成条件**: 達成率 ≥ 60%

### 注釈
- 分母（実施日数）はDB記録の対象外。部内記録（スプレッドシート等）で「実施日」を管理し、この SQL の total_sessions と突き合わせることで初めて率が出る
- この指標が達成できない背景リスクは PRD §7「最大のリスク仮説」に記録済み（マネ艇が録らない）
- SQL実装は不要（Session テーブルに自動で記録される）

---

## 指標②：反省会での使用回数（月次集計）

### 定義
**「反省会でのリプレイ使用が月4回以上」**

この指標の**正式な計測方法は部内記録（スプレッドシート等）に基づく**。SQLは**参考値・突き合わせ用**として位置づけられる。

### 正式な計測方法（部内記録）
部内記録として以下を毎回記録：
- 実施日時
- 対象セッション（使用したセッションのID）
- 参加人数
- 議論内容の要約（該当あれば）

月別に「異なるセッションが何回使用されたか」を集計し、月4回以上を達成基準とする。

### SQL（参考値・突き合わせ用）
```sql
SELECT 
  TO_CHAR("createdAt", 'YYYY-MM') as month,
  COUNT(DISTINCT "sessionId") as distinct_sessions_used,
  COUNT(*) as total_annotations
FROM "Annotation"
WHERE "sessionId" IN (SELECT "id" FROM "Session" WHERE "teamId" = 1)
GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
ORDER BY month DESC;
```

### 実行例（2026-07-26）
```
  month  | distinct_sessions_used | total_annotations
---------+------------------------+-------------------
 2026-07 |                      1 |                 1
(1 row)
```

### 読み方と利用方法
- **SQL出力の`distinct_sessions_used`**: 注釈が付けられたセッション数（参考値）
- **部内記録の異なるセッション数**: 実際に使用したセッション数（正式値）
- **指標達成条件**: 部内記録の月別セッション数 ≥ 4

### 注釈：SQL参考値の限界
- **SQL の値が 0 でも反省会は使用されている可能性がある**（注釈が付けられなかった場合）
- **逆に、注釈の個数（total_annotations）が多い月でも、セッション数は少ないかもしれない**（少数のセッションに集中）
- このため、SQL は「指標②を単独で判定できない」。必ず部内記録と照合すること
- **指標③との独立性を保つため**: 指標②の計測値は部内記録単体で確定し、SQL は「念のため照合用」に限定する

---

## 指標③：注釈総数

### 定義
**「注釈が累計30件以上」**

指定チームのセッション配下に作成されたすべての Annotation を累計する。

### SQL
```sql
SELECT 
  COUNT(*) as total_annotations,
  COUNT(DISTINCT "sessionId") as sessions_with_annotations
FROM "Annotation"
WHERE "sessionId" IN (SELECT "id" FROM "Session" WHERE "teamId" = 1);
```

### 実行例（2026-07-26）
```
 total_annotations | sessions_with_annotations
-------------------+---------------------------
                 1 |                         1
(1 row)
```

### 読み方
- **total_annotations**: 注釈の総数（累計）= **1 件**
- **sessions_with_annotations**: 注釈が付いたセッション数 = 1 セッション
- **指標達成条件**: 累計 30 件以上の注釈が作成される

### 注釈
- `isPublic` フラグ（公開/非公開）は参照しない（指標は部内注釈を含める）
- 削除された注釈は DB に残らない（CASCADE）

---

## 共有段階の計測値（参考）

### 共有1→共有2 への前進条件（rev.6）

| 条件 | SQL | 説明 |
|---|---|---|
| ①昇格セッション月2本以上×2ヶ月 | `SELECT TO_CHAR("publishedAt", 'YYYY-MM') as month, COUNT(*) FROM "Session" WHERE "publishedAt" IS NOT NULL GROUP BY month HAVING COUNT(*) >= 2` | 昇格済みセッション（visibility = 'unlisted' または 'public'）を月別集計。2ヶ月連続で2本以上 |
| ③部外からの閲覧が実際に発生 | `SELECT COUNT(*) FILTER (WHERE "publicViewCount" > 0) as sessions_with_views FROM "Session" WHERE "publishedAt" IS NOT NULL` | **UI に表示しない**（PRD §5-7 非KPI）。SQL でのみ参照。条件：①`publicViewCount > 0` のセッションが3本以上、かつ ②他大学関係者への公開URL実送付が2件以上（後者は部内記録で管理）。SQLは①の下限値を確認するもの |

---

## 実行結果レポート

### テスト環境
- **環境**: ローカル Docker PostgreSQL
- **サーバー**: `localhost:5433`
- **DB**: `sailvlog_db`
- **テスト対象チーム**: `teamId = 1`
- **実行日**: 2026-07-26

### テスト結果（修正版検証・2026-07-26）
すべてのSQLが**エラーなく実行**でき、数値が返されることを確認。

| 指標 | SQL条件 | 結果 | ステータス |
|---|---|---|---|
| ① アップロード数 | `2026-07-15 ～ 2026-07-31` | total=2, practice=2, race=0 | ✅ 正常 |
| ② 反省会使用回数 | 月別集計（全期間） | 2026-07: 2 セッション, 3 注釈 | ✅ 正常 |
| ③ 注釈総数 | 全期間累計 | total=3, sessions=2 | ✅ 正常 |
| 共有1→2 条件① | `publishedAt IS NOT NULL` | 昇格済みセッション: 0 件 | ✅ 正常（未昇格） |
| 共有1→2 条件③ | `publicViewCount > 0` | 閲覧記録あり: 0 件 | ✅ 正常（未実装） |

### 未検証項目
- **Neon へのデプロイ**: B-3 ブロック（オーナーのアカウント未作成）
  - ローカル PostgreSQL で動作確認済みのため、本番環境への移行時に即座に実行可能
  - SQL の変更は不要（PostgreSQL 13+ 標準構文を使用）

---

## 運用上の注意

### いつ実行するか
1. **Phase 1 実施中**: 
   - **指標①**: 毎週1回、SQL実行 → 分子を確認。部内記録の実施日数と照合して率を手計算
   - **指標②**: 毎週1回、部内記録を更新し、前月の「異なるセッション数」を集計。参考値として SQL も実行（ただし部内記録が正式値）
   - **指標③**: 毎週1回、SQL実行して注釈累計数を確認

2. **Phase 1 終了時（8週間後）**: ①～③ の達成判定
   - ① の達成率 ≥ 60%、② の月別セッション数 ≥ 4 回/月（部内記録から確定）、③ の累計 ≥ 30 なら PRD Phase 2 へ進行

### teamId の変更方法
上記すべてのSQLで `WHERE "teamId" = 1` を対象チームの ID に置き換える。

例：対象チームが `teamId = <対象チームのID>` の場合
```sql
WHERE "teamId" = <対象チームのID>
```

### 共有段階の前進確認
- 共有1→共有2: `publicViewCount` を定期確認（非KPI なので UI には出さない）
- SQLで参照可能：`SELECT COUNT(*) FROM "Session" WHERE "publicViewCount" > 0 AND "publishedAt" IS NOT NULL`

---

## 質問・トラブルシューティング

**Q: 指標②で「注釈 0 件」の月が表示されない**  
A: `GROUP BY` のため、該当月が返されません。スプレッドシートで 0 を手作業記入するか、ユニオンクエリで対応可能。

**Q: 削除されたセッション・注釈はカウントされる？**  
A: いいえ。Cascade で自動削除され、DB に残りません。

**Q: CSV 出力したい**  
A: `psql` の `-c` オプションで実行し、`\copy (SELECT ...) TO 'file.csv' WITH (FORMAT csv, HEADER);` で出力可能。

---

## 参考資料

- **PRD §6**: 成功の定義（定義元）
- **ARCH.md §3**: Session/Annotation スキーマ設計
- **TASKS.md T-92**: 本タスク（SQL 作成）
- **SPEC-share1-phase1.md**: 共有1（公開化）の仕様（publicViewCount 参照ルール）
