# Step 1 — 環境構築

## 達成目標

- `http://localhost:3000` でトップページが表示される
- `http://localhost:8000/api/health` でヘルスチェックが返る

## 手順

### 1. Docker Desktop が起動していることを確認

タスクバーに Docker クジラアイコンが表示されていればOK。

### 2. コンテナを起動する

```bash
cd sailvlog
docker compose up --build
```

初回は npm install や Docker イメージのビルドが走るので 3〜5 分かかります。

### 3. マイグレーションとシードの実行

コンテナが起動したら、別ターミナルで実行：

```bash
docker compose exec backend npx prisma migrate dev --name init
docker compose exec backend npm run db:seed
```

### 4. 動作確認

| URL | 期待する表示 |
|-----|------------|
| http://localhost:3000 | トップページ（記事一覧） |
| http://localhost:8000/api/health | `{"status":"ok","timestamp":"..."}` |
| http://localhost:8000/api/boat-types | 艇種一覧（JSON） |

---

## よくあるエラーと対処

### `ECONNREFUSED` が出る場合

backend が db より先に起動しようとして失敗している。  
`docker compose up` を一度 Ctrl+C で止めて再実行すると直ることが多い。

### `prisma:error` が出る場合

`.env` の `DATABASE_URL` が docker-compose.yml の設定と一致しているか確認。

### ポート 5432 が使用中の場合

ローカルの PostgreSQL を停止するか、docker-compose.yml のポートを `"5433:5432"` に変更する。
