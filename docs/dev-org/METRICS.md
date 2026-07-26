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
| **①** | 練習・レース日の60%以上で収録→アップロード成立 | Session テーブルのレコード数（期間内） | 全体の60%以上 |
| **②** | 反省会でのリプレイ使用が月4回以上 | Annotation が作られた日=反省会使用日と推測し、月別セッション数を集計 | 月4セッション以上 |
| **③** | 注釈が累計30件以上 | Annotation テーブルのレコード総数 | 累計30件以上 |

---

## 指標①：アップロード数（セッション数）

### 定義
**「練習・レース日の60%以上で収録→アップロード成立」**

セッションの作成 = GPX ファイルのアップロード成功。以下の2つの数値で成功を判定する：
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
  AND "startedAt" >= '2026-07-26'  -- Phase 1 開始日
  AND "startedAt" < '2026-09-20';  -- Phase 1 終了日（8週間想定）
```

### 実行例（2026-07-26）
```
 total_sessions | practice_sessions | race_sessions
----------------+-------------------+---------------
              1 |                 1 |             0
(1 row)
```

### 読み方
- 現在までに 1 セッションのアップロードが成立（練習 1、レース 0）
- **指標達成条件**: 8 週間で計画された練習・レース日数の 60% 以上のセッションが登録される

### 注釈
- この指標が達成できない背景リスクは PRD §7「最大のリスク仮説」に記録済み（マネ艇が録らない）
- 実装は不要（Session テーブルに記録される）

---

## 指標②：反省会での使用回数（月次集計）

### 定義
**「反省会でのリプレイ使用が月4回以上」**

`Annotation`（タイムライン注釈）が作成された日 = 反省会でセッションが実際に使用された日と推測する。

月別に「異なるセッションが何個使用されたか」を集計し、月4セッション以上の使用を成功基準とする。

**理由**:
- 反省会の実施日時は部内記録（手作業）として別途管理。DB では直接記録しない
- 注釈が作られた = セッション再生中に意見交換・議論が発生 = 反省会で使用された
- 1 セッション＝ 1 回の反省会（同じセッションに複数の注釈があっても 1 回としてカウント）

### SQL
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

### 読み方
- **2026-07**: 1 セッションが反省会で使用され、1 つの注釈が作成された
- **指標達成条件**: 月間 4 セッション以上が反省会で使用される（＝ 4 回以上異なるセッションが開かれた）

### 補足：部内記録との対応
実装チェックリスト T-92 の「部内記録」とは：
- 形式: スプレッドシート or ドキュメント（テンプレート提供予定）
- 記録内容: 実施日・対象セッション・参加人数・議論内容の要約
- DB との対応: この SQL の `month` と `distinct_sessions_used` と突き合わせ（異なるセッションが月4個以上記録されていれば OK）

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
| ①昇格セッション月2本以上×2ヶ月 | `SELECT TO_CHAR("publishedAt", 'YYYY-MM') as month, COUNT(*) FROM "Session" WHERE visibility = 'public' AND "publishedAt" IS NOT NULL GROUP BY month HAVING COUNT(*) >= 2` | 公開済み (`visibility='public'`) セッション数を月別集計。2ヶ月連続で2本以上 |
| ③部外からの閲覧が実際に発生 | `SELECT COUNT(*) FILTER (WHERE "publicViewCount" > 0) as sessions_with_views FROM "Session" WHERE visibility = 'public'` | **UI に表示しない**（PRD §5-7 非KPI）。SQL でのみ参照。公開セッション 3 本以上が 0 回以上閲覧を記録 |

---

## 実行結果レポート

### テスト環境
- **環境**: ローカル Docker PostgreSQL
- **サーバー**: `localhost:5433`
- **DB**: `sailvlog_db`
- **テスト対象チーム**: `teamId = 1`
- **実行日**: 2026-07-26

### テスト結果
すべてのSQLが**エラーなく実行**でき、数値が返されることを確認。

| 指標 | クエリ | 結果 | ステータス |
|---|---|---|---|
| ① アップロード数 | `COUNT(*) FROM "Session"` | total=1, practice=1, race=0 | ✅ 正常 |
| ② 反省会使用回数 | `GROUP BY MONTH` | 2026-07: 1 セッション | ✅ 正常 |
| ③ 注釈総数 | `COUNT(*) FROM "Annotation"` | total=1, sessions=1 | ✅ 正常 |

### 未検証項目
- **Neon へのデプロイ**: B-3 ブロック（オーナーのアカウント未作成）
  - ローカル PostgreSQL で動作確認済みのため、本番環境への移行時に即座に実行可能
  - SQL の変更は不要（PostgreSQL 13+ 標準構文を使用）

---

## 運用上の注意

### いつ実行するか
1. **Phase 1 実施中**: 毎週 1 回、指標①～③を実行してダッシュボードに記録（手作業）
   - 指標①: 水曜朝（練習日集計）
   - 指標②: 月初（前月の使用回数確定）
   - 指標③: 任意タイミング（常に監視可能）

2. **Phase 1 終了時（8週間後）**: ①～③ の達成判定
   - ① > 60%、② ≥ 4/month、③ ≥ 30 なら Phase 2 へ進行

### teamId の変更方法
上記すべてのSQLで `WHERE "teamId" = 1` を対象チームの ID に置き換える。

例：東京大学ヨット部が `teamId = 5` の場合
```sql
WHERE "teamId" = 5
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
