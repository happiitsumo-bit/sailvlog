# デプロイ手順書（runbook）

<!-- 作成: 2026-08-02 / Team Lead。毎回のデプロイでこの順に実行する -->

本番構成: **Neon（DB）/ Render（backend・Docker）/ Vercel（frontend・Next.js）**
公開URL: https://sailvlog.vercel.app / API: https://sailvlog-rfxx.onrender.com

**本番リリースブランチは `main`**（2026-07-30 オーナー裁定）。`v3/replay-mvp` から `main` へマージして公開する。

---

## 0. 事前確認

**⚠ 最初に必ず作業ディレクトリへ移動する。** `~/workspace/dev` は別のリポジトリなので、
そこで実行すると `unknown revision` や `No such file or directory` になる（2026-08-02に実際に発生）。

```bash
cd ~/workspace/dev/sailvlog
git rev-parse --show-toplevel   # /Users/nova/workspace/dev/sailvlog と出ることを確認
```

```bash
git fetch --all
git log --oneline origin/main..origin/v3/replay-mvp | wc -l   # 未反映のコミット数
git log --oneline origin/main..origin/v3/replay-mvp -- frontend backend  # コード変更の有無
ls backend/prisma/migrations/                                  # 新しいmigrationの有無
```

- **コード変更がゼロ（docsのみ）なら、Render/Vercel の再デプロイは不要**
- **新しい migration があれば、手順2を必ず先に実行する**

---

## 1. `main` へマージ

```bash
git checkout main && git pull origin main
git merge v3/replay-mvp
git push origin main
```

---

## 2. migration を Neon へ適用（**コードのデプロイより先**）

**なぜ先か（expand-first）**: 新しいコードは新しいカラムを前提に `select` するため、
先にコードを出すと **存在しないカラムを読んで500になる**。列の追加を先、コードを後にする。

### ⚠ 危険操作の注意（過去に事故りかけた箇所）

- **`DATABASE_URL` を `export` しないこと。** `.env.test` はシェルの既存環境変数を上書きしないため、
  同じシェルで `npm test` を叩くと**本番DBが全テーブルTRUNCATEされる**（REVIEW-backend-2 B-01）
- **接続文字列は `-pooler` を除いた直結URL**を使う。プール経由だと migration が失敗する（T-02の発見事項）
- 本番イメージは `npm install --omit=dev` で `prisma` CLI が入らないため、**Render上では実行できない。ローカルから叩く**

```bash
cd backend
DATABASE_URL="<Neonの直結URL・-poolerなし>" npx prisma migrate deploy
```

適用後、`Applied N migrations` の出力を確認する。

---

## 3. Render（backend）

**Auto-Deploy は Off** の運用（Issue #20 の原因。設定を変える場合は別途裁定）。

1. サービスの **Branch が `main`** になっているか確認（**新規サービス作成時に既定の `main` へ戻る挙動があり、過去2回踏んでいる**）
2. **Root Directory は `backend`**。Dockerfile Path にディレクトリを指定しない
   （Root Directory と Docker Build Context のどちらか一方にのみ `backend` を指定する）
3. 環境変数を確認・設定（下記「環境変数」節）
4. **Manual Deploy → Deploy latest commit**
5. デプロイログで `Checking out commit ... in branch main` が**意図したコミット**であることを確認

---

## 4. Vercel（frontend）

1. **Framework Preset が `Next.js`** になっているか確認
   （モノレポ検出で `Other` に落ちると、**ビルドは成功するのに全パスがプラットフォーム404**になる。
   ビルドログにエラーが出ないため気づきにくい。404本文がプレーンテキストの `NOT_FOUND` ならこれを疑う）
2. **Deployment Protection**（Require Log In）が **Off** であること
   （On だと未ログインの相手に `/` が `vercel.com/sso-api` へ302し、中身が返らない）
3. 環境変数を確認・設定（下記）
4. 再デプロイ

---

## 環境変数

| 変数 | 置き場所 | 注意 |
|---|---|---|
| `DATABASE_URL` | Render | Neon の接続文字列 |
| `JWT_SECRET` | Render | **32文字以上**かつ既知プレースホルダでないこと（本番では `assertJwtSecretConfigured` が起動を拒否）。**変更すると発行済みJWT（有効期限2h）が全て即座に無効になる**ので、反省会の前後で変更しない |
| `JWT_EXPIRES_IN` | Render | `2h` |
| `CORS_ORIGIN` | Render | `https://sailvlog.vercel.app` |
| **`INTERNAL_PROXY_SECRET`** | **Render と Vercel の両方に同じ値** | 下記参照。**`NEXT_PUBLIC_` を付けないこと**（付けるとクライアントJSに焼き込まれて漏れる・ADR-010） |
| `NEXT_PUBLIC_API_URL` | Vercel | `https://sailvlog-rfxx.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | Vercel | `https://sailvlog.vercel.app`（OGPの絶対URL解決に使う） |

### `INTERNAL_PROXY_SECRET` について（**公開URLを配れるかどうかを決める**）

公開ページ `/p/[slug]` は Next.js のサーバー側から backend を呼ぶ。この秘密が**両側で一致している場合のみ**、
backend は転送された実クライアントIPを信頼してレート制限のバケットを分ける（ADR-010・R-03）。

- **未設定でも壊れない**（安全側にフォールバックし、backend は `req.ip` を使う）
- **ただし未設定だと、公開ページへの全アクセスが Vercel サーバ1台のIPとして到着し、
  1分61回で全公開URLが404になる**。＝**外部に公開URLを配れない**

値の生成（**生成した値をチャットやIssueに貼らないこと。このリポジトリはPUBLIC**）:

```bash
openssl rand -base64 48
```

---

## 5. デプロイ後の検証

```bash
# cold start（アイドル後の初回。12.5秒程度かかるのが既知。受容済み）
curl -o /dev/null -s -w 'health total=%{time_total}\n' https://sailvlog-rfxx.onrender.com/api/health

# 今回のデプロイで入ったAPIが本番に反映されているか（404ならデプロイ漏れ＝Issue #20の再発）
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://sailvlog-rfxx.onrender.com/api/teams/join   # 401が正（404はデプロイ漏れ）

# frontend
curl -s -o /dev/null -w '%{http_code}\n' https://sailvlog.vercel.app/          # 200
curl -s -o /dev/null -w '%{http_code}\n' https://sailvlog.vercel.app/handbook  # 200

# 凍結ルートが410のままか（v2機能が復活していないこと）
curl -s -o /dev/null -w '%{http_code}\n' https://sailvlog-rfxx.onrender.com/api/articles  # 410
```

**「最新コミットに含まれるはずのエンドポイントが本番で404」は Issue #20 の再発シグナル。**
気づかないまま数日運用してしまった実績があるので、毎回この確認を行う。

---

## Q&A / トラブルシューティング

**Q. デプロイは成功したのに全ページが404になる**
A. Vercel の Framework Preset が `Other` に落ちている。`Next.js` に変更して再デプロイ。
404本文がNext.jsの404ページでなくプレーンテキストの `NOT_FOUND` ならこれ。

**Q. 未ログインで開くとログイン画面に飛ばされる（Vercelの）**
A. Deployment Protection が有効。Settings → Deployment Protection → Require Log In を Off。Hobbyプランでも操作可能。

**Q. Render のビルドが `backend/backend` を探して失敗する**
A. Root Directory と Docker Build Context の**両方**に `backend` を指定している。どちらか一方にする。

**Q. migration が「advisory lock」等で失敗する**
A. 接続文字列に `-pooler` が入っている。**直結URL**を使う。

**Q. 反省会の最中に全員がログアウトされた**
A. `JWT_SECRET` を変更して再デプロイした。発行済みJWTが即座に無効になる。反省会の前後で触らない。

**Q. 公開URLを外部に配ってよいか**
A. `INTERNAL_PROXY_SECRET` が **Render と Vercel の両方に同じ値で設定されている**ことが条件。
未設定だと1分61回で全公開URLが404になる。設定状況は `GATES.md` ③の運用制約欄と合わせて判断する。
