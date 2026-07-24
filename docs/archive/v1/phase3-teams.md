# Phase 3 企画書：大学・チームページ

**バージョン:** 1.1（Gemini レビュー反映）
**作成日:** 2026-05-20

---

## 1. 目的

「部の知識が卒業・引退とともに消える」という問題を解決する。

大学のヨット部・チームが自分たちの技術アーカイブを持ち、**OB/現役が共同で知識を蓄積し続ける場**を作る。

---

## 2. 完成イメージ

### `/teams` — チーム一覧ページ
- カテゴリフィルタ（university / club / professional）
- 艇種フィルタ
- チームカード：名前・艇種・メンバー数・記事数

### `/teams/[slug]` — チーム詳細ページ
- ヘッダー：チーム名・カテゴリ・所属艇種・bio
- タブ: Members / Articles / Q&A
- Members タブ: OB/OG と現役を分けて表示
- Articles タブ: `teamId` で紐づいた記事一覧

---

## 3. DBスキーマ設計

### 新規モデル

```prisma
enum TeamRole {
  member  // 現役
  ob      // OB/OG
  admin   // 主将・主務（管理権限）
}

enum TeamCategory {
  university    // 大学ヨット部
  club          // クラブチーム
  professional  // 実業団
}

model Team {
  id          Int          @id @default(autoincrement())
  slug        String       @unique @db.VarChar(100)
  name        String       @db.VarChar(100)
  university  String?      @db.VarChar(100)  // 大学名（categoryがuniversityの場合）
  region      String?      @db.VarChar(50)   // 地域（例: 関東, 関西）
  bio         String?      @db.Text
  category    TeamCategory @default(university)
  logoUrl     String?
  createdAt   DateTime     @default(now())

  members     TeamMember[]
  articles    Article[]
  questions   Question[]
}

model TeamMember {
  id        Int      @id @default(autoincrement())
  role      TeamRole @default(member)
  joinedAt  DateTime @default(now())

  userId    Int
  user      User @relation(fields: [userId], references: [id])

  teamId    Int
  team      Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([userId, teamId])
}
```

### 既存モデルへの追加

```prisma
// Article に追加
teamId    Int?
team      Team? @relation(fields: [teamId], references: [id])

// Question に追加
teamId    Int?
team      Team? @relation(fields: [teamId], references: [id])
```

---

## 4. APIエンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/teams` | 一覧（?category=university&boat_type=470） |
| GET | `/api/teams/:slug` | 詳細（メンバー・記事数・Q&A数 含む） |
| GET | `/api/teams/:slug/articles` | チームの記事一覧 |
| GET | `/api/teams/:slug/questions` | チームのQ&A一覧 |

Phase 3b（次フェーズ）でチーム管理API（POST/PATCH + 認証）を追加予定。

---

## 5. ファイル変更一覧

| 種別 | ファイル | 内容 |
|------|---------|------|
| 修正 | `backend/prisma/schema.prisma` | Team, TeamMember Enum/モデル追加、Article/Question に teamId 追加 |
| 新規 | `backend/src/routes/teams.ts` | GET /api/teams, /api/teams/:slug |
| 修正 | `backend/src/index.ts` | /api/teams ルート登録 |
| 修正 | `backend/prisma/seed.ts` | サンプルチームデータ追加 |
| 新規 | `frontend/src/app/teams/page.tsx` | チーム一覧ページ |
| 新規 | `frontend/src/app/teams/[slug]/page.tsx` | チーム詳細ページ |
| 修正 | `frontend/src/config/navigation.ts` | Teams ナビ追加 |
| 修正 | `frontend/src/types/index.ts` | Team, TeamMember 型追加 |

---

## 6. スコープ外（Phase 3b）

- 限定公開記事（isPrivate フラグ + TeamMember 認証）
- チーム参加申請・承認フロー
- チーム管理画面（admin ロール限定）
- Ctrl+K へのチーム名検索追加（APIが揃ったタイミングで統合）
