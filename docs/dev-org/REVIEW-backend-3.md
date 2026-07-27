# REVIEW-backend-3.md — 監査ラウンド2（修正が新しい穴を作っていないか）

<!-- 契約: 作成者 code-reviewer / 対象 v3/replay-mvp 309b035..e227dc7 / 判定材料: ③Quality Gate -->
<!-- 記録経緯: code-reviewer は出力ポリシー上ファイルを書き出せなかったため、報告内容を Team Lead が転記した。
     転記時に Team Lead が実測で裏を取った項目には「Team Lead実測」を明記している。 -->

- 対象: `v3/replay-mvp` `309b035..e227dc7`（backend のみ。frontend は読み取りのみ）
- 日付: 2026-07-28 / レビュアー: code-reviewer
- **Gate判定意見: FAIL**（Blocker 2件。うち B3-01 は出荷前必須）

## 件数サマリ

| | Blocker | Major | Minor | 計 |
|---|---|---|---|---|
| 新規に作り込まれた問題 | 1 | 4 | 3 | 8 |
| ラウンド1で見落とした問題 | 1 | 2 | 3 | 6 |
| **計** | **2** | **6** | **6** | **14** |

**新規に作り込まれた問題: あり（8件）**。ラウンド1の Blocker 2/Major 7 は、いずれも「意図した方向」には直っている。ただし M-04（レート制限）と B-02（410凍結）の2つが、それぞれ別の経路で新しい欠陥を持ち込んでいる。

---

## Blocker

### B3-01【新規】login レート制限が「IP単位」として機能せず、反省会当日に部員全員がログイン不能になる

- 場所: `backend/src/routes/auth.ts`（login のレート制限呼び出し）、`backend/src/lib/rateLimiter.ts`、`backend/src/index.ts`（**`app.set("trust proxy")` が存在しない** — Team Lead実測: `grep -rn "trust proxy" backend/src` がヒット0件）
- 確度: **CONFIRMED**

このプロジェクトは**同じ罠を一度踏んで、公開APIでは既に解決している**。`backend/src/routes/public.ts` のコメントがそれを明記している:

> `req.ip` は常に「Next.jsサーバー1台のIP」になり、レート制限/閲覧数カウントが実質1ユーザー分に潰れる

M-04 はその教訓を適用せず、素の `req.ip` を使った。

**失敗シナリオ①（プロキシ潰れ・確度 疑い（高））**: Render は edge でTLS終端し内部プロキシ経由で Node に届く。`trust proxy` 未設定なので `req.ip` は socket の remote address ＝ Render 内部プロキシのIP。**全ユーザーが1バケットを共有**する。7/31 の反省会で部員が一斉にログイン → 60秒あたり10回を超えた11人目以降が全員 429。攻撃も不要、平常運用で起きる。
検証方法: 本番の `POST /api/auth/login` を別々の回線から11回叩き、11回目が429になるか見る。

**失敗シナリオ②（NAT・確度 CONFIRMED）**: ①を `trust proxy` 設定で正しく直したとしても、**大学のNAT・部室のWi-Fi配下は全員が同一グローバルIP**。部員20名が反省会直前に一斉ログインすると、11人目から60秒間ログイン不能。つまり「IP単位10回/60秒」という値は、**この製品の唯一の利用シーン（部室で全員集合）と正面から衝突している**。

さらに frontend 側は `frontend/src/lib/api.ts` で 401 のみ特別扱いし、429 は素のエラーとして投げるだけ。「しばらく待てば直る」ことがユーザーに伝わる設計になっていない。

**推奨対応（方針のみ）**:
1. `app.set("trust proxy", 1)` を入れて `req.ip` を実クライアントIPにする（ただし②は解決しない）
2. **キーを「IP」から「IP+email」または「email」中心に変える**。総当たり防止の本質は「1アカウントへの試行回数」であり、共有IP配下の正常ログインを巻き込まない。加えて IP 単位は緩め（例: 60秒60回）にして DoS の蓋だけ残す
3. **成功したログインはカウントしない**（現状は成功も1消費する）
4. これらは ADR-010（実クライアントIPの信頼モデル）と同じ論点なので、決定は ADR に追記する

### B3-02【ラウンド1見落とし】新規ユーザーがチームに加入する経路がバックエンドに存在しない

- 場所: `backend/src/routes/teams.ts`（`POST /` も加入エンドポイントも無い）、`backend/prisma/seed.ts`（team は upsert するが `teamMember` も user も作らない）、`backend/src/__tests__/t95-auth-required-blocker.test.ts`（テストが `prisma.teamMember.create` を直接叩いている＝APIが無い証拠）
- 確度: **CONFIRMED**

**失敗シナリオ**: 部員が `/register` で登録 → `/sessions/new` を開く → `GET /api/teams` が `{teams: [], total: 0}` → **チーム選択のセレクトボックスが空** → セッションを1件も作れない。エラーも出ない（`.catch(() => {})` で握り潰し）。

これは B-02 修正が壊したのではない（修正前も `POST /api/sessions` は403になった）。しかし修正前は「チーム一覧が見えて、選ぶと403エラーが出る」＝**壊れていることが見えた**。修正後は「何も見えない」＝**壊れていることすら分からない**。

**推奨対応**: ①「所属チームが0件のときに何を案内するか」を決める（frontend側の空状態表示はCodex側タスク）②チーム加入を当面「オーナーがDB/seedで投入」と運用で割り切るなら、**それをTASKS.mdに明記**して「実装漏れ」ではなく「意図した運用」に格上げする。
**Team Lead向けの裁定材料**: 運用でDB投入すると決めるなら Major に降格して良い。**決めていないまま出荷するのは Blocker のまま**。

---

## Major

### M3-01【新規】`PUT /api/users/me` が `router.all("/:username")` に飲まれて410を返す（修正のコメント自身と矛盾）

- 場所: `backend/src/routes/users.ts` の `router.all("/:username")` と `router.put("/me")` の登録順
- 確度: **CONFIRMED（Team Lead が実サーバで実測）**
  ```
  GET  /api/users/me -> 200
  PUT  /api/users/me -> 410
  ```
- なぜ問題か: 修正コミット自身のコメントが「自分自身のプロフィール取得/更新（GET・PUT /api/users/me）は凍結対象外（残す）」と宣言しているのに、実装がそれを破っている。旧コードは `router.get("/:username")` だったのでメソッド違いで貫通していたが、`router.all` に変えたことでPUTも捕まるようになった。**典型的な「直したことで壊れた」**。
- 実害の現状: v3 frontend に `/api/users` の呼び出しはゼロ（grep済み）なので今日壊れている画面は無い。ただし t95 は `GET /me` しか検証しておらず、**テストが素通ししたまま出荷される**のが本質的な問題。
- 推奨対応: `router.all("/:username")` を `PUT /me` より後ろに移す。同時に `PUT /api/users/me` の200を検証する回帰テストを1本追加する。

### M3-02【ラウンド1見落とし】`POST /api/auth/register` はレート制限なし。bcrypt cost 12 のDoSは半分しか塞げていない

- 場所: `backend/src/routes/auth.ts`（register。`bcrypt.hash(password, 12)`）— レート制限の呼び出しが無い
- 確度: **CONFIRMED**
- なぜ問題か: M-04 の根拠は「bcrypt cost 12 の比較は1回数百ms・Nodeのスレッドプール(既定4)を専有する」。この論理は `bcrypt.hash`（compare より重い）にもそのまま当てはまる。**同じ脅威に対して片方のドアだけ閉めた**。
- 失敗シナリオ: `POST /api/auth/register` を毎秒20回、ユニークな username/email で送る → libuv スレッドプール4本が飽和 → **全リクエストが待たされる**（反省会中に公開ページも一緒に固まる）。副次的にゴミアカウントが無制限に作られる。
- 推奨対応: register にも同じレート制限を適用する。B3-01 のキー設計変更と合わせて一度に決める。

### M3-03【新規】`JWT_SECRET` fail-fast が、自分で新しく作った「リポジトリ公開値」を通してしまう

- 場所: `backend/src/lib/assertJwtSecretConfigured.ts` の `KNOWN_PLACEHOLDERS`、`docker-compose.yml`、`backend/.env.test`
- 確度: **CONFIRMED（Team Lead が値を実測）**

  | 値 | 長さ | ガード判定 | 公開リポジトリに平文で存在 |
  |---|---|---|---|
  | `change_this_secret_in_production` | 32 | **拒否**（既知リスト） | ✅ `.env.example` |
  | `dev-only-jwt-secret-change-me-1234567890abcdef` | 46 | **通過** | ✅ `docker-compose.yml` |
  | `test_secret_do_not_use_in_prod_1234567890` | 41 | **通過** | ✅ `.env.test` |

- なぜ問題か: このガードの設計思想は「リポジトリに平文で存在する値が本番に残っていたら誰でもJWTを偽造できる」。ところが M-05 の修正は、検知対象の値を**別のリポジトリ平文値に差し替えただけ**で、新しい値をリストに入れていない。**ガードの前提が自分の手で壊れている**。
- 失敗シナリオ: 誰かが Render の環境変数を設定し忘れ、`docker-compose.yml` の値をコピペする（32文字ルールを満たす都合の良い値がそこにある）→ ガードは沈黙して起動 → GitHub を見た第三者が `jwt.sign({userId:1}, "dev-only-jwt-secret-change-me-1234567890abcdef")` で**任意ユーザーになりすまし、全チームの全セッションに読み書き**できる。B-02 で塞いだ名簿も全部読める。
- 推奨対応: `KNOWN_PLACEHOLDERS` を「`docker-compose.yml`/`.env.test`/`.env.example` の値を機械的に拾う」形にするか、少なくとも新2値を追加する。`NODE_ENV === "production"` のときだけ厳格化する分岐も検討に値する。
- 補足（良い点）: エラーメッセージは長さのみ出力し、**秘密そのものは一切出していない**。

### M3-04【新規】ARCH.md ADR-009 が実装と矛盾したまま

- 場所: `docs/dev-org/ARCH.md` の ADR-009。ADR は 011 までで **ADR-012 は存在しない**。B-02 修正コミット `4d14081` はドキュメントを一切触っていない
- 確度: **CONFIRMED**
- なぜ問題か: ADR-009 は「`GET /api/sailors`・`/api/users/:username` に `authMiddleware` を付け部内ログイン済み限定にする」と決定し、**「却下した代替案: ①410凍結（ADR-003方式）— フロントが現用中のため不可」**と明記している。実装は正反対に、まさにその410凍結を採用した。
- **どちらが正か**: **コードが正しい**。ADR-009 の却下理由「フロントが現用中」は `teamRole.ts` に対する判断であって、`sailors`/`users/:username` には元々当てはまらなかった（frontend 利用ゼロ）。つまり**コードのバグではなくADRの更新漏れ**。
- 推奨対応: ADR-012 として「名簿系の機密境界を『認証済みか』から『そのチームのメンバーか』へ変更」を起票し、ADR-009 に「ADR-012 により上書き」と追記。§4のAPI表の `GET /api/teams` 行も「自分の所属チームのみ」に訂正。

### M3-05【ラウンド1見落とし】「含めるものだけ列挙する」規律が `POST`/`PATCH /api/sessions` に適用されていない

- 場所: `backend/src/routes/sessions.ts` の POST（`res.status(201).json({ session })`）、PATCH（`prisma.session.update` 全カラム → `res.json({ session })`）
- 確度: **CONFIRMED**
- なぜ問題か: M-02 のコミットメッセージは「将来カラムが増えても同じ取りこぼしが構造的に起きない」と主張したが、実際に直したのは一覧1本のみ。同じ `publicViewCount`（PRD §6「APIにも画面にも出さない」）が PATCH から漏れ続けている。**GET :id では R-02 で除外済み、一覧では M-02 で除外済み、PATCH だけ残っている**という一貫性の欠如（**同じ指摘を3回出している**）。
- 影響範囲は部内メンバーのみなので機密漏洩ではなく方針違反。
- 推奨対応: `POST`/`PATCH` の戻りも `select` ホワイトリストに揃えるか、共通のシリアライザに一本化する。

### M3-06【新規】今回追加した本番コード4件のうち、テストが付いたのは1件だけ

| コミット | 内容 | テスト |
|---|---|---|
| B-01 | `assertSafeToTruncate` 等3層ガード | **なし** |
| `4d14081` B-02/M-01 | 名簿系の認可変更 | ✅ t95 更新 |
| `6e48ebd` M-07 | boatTypes に wrap() | **なし** |
| `c4d2d9d` M-04 | login レート制限 | **なし** |
| `e1e19b9` M-05 | JWT fail-fast | **なし** |
| `ca915d0` M-02 | select ホワイトリスト | 既存テストが FAIL→PASS ✅ |
| `e227dc7` M-06 | PATCH 構造検証 | ✅ t12 +41行 |

- 確度: **CONFIRMED**
- なぜ問題か: deliverables ルールは「製品コードはテストを同時に作成する」と定めている。特に **M-04 は無テストのまま B3-01 という Blocker を作り込んだ**。`_resetAuthRateLimiterForTests()` を export しておきながら**どこからも呼ばれていない**ことが、テストを書かなかった証拠になっている。
- 推奨対応: 最低でも ①login 11回目が429 ②`assertJwtSecretConfigured` が既知プレースホルダ/31文字/未設定を throw ③`resetDb` が非 `_test` DB名で throw の3本。①は書いていれば「supertest だと全リクエストが同一IPになる」ことに気づき、**B3-01 の発見につながった可能性が高い**。

---

## Minor

- **m3-01【新規・CONFIRMED】`ensure-test-db.js` だけ `override` が付いていない。** `setup/env.ts` は `override: true` にしたが `scripts/ensure-test-db.js` は `dotenv.config()` のまま。シェルに `DATABASE_URL` を export すると、**pretest はシェルのDBに、jest 本体は `.env.test` のDBを見る**食い違いが起きる（症状は「テーブルが存在しません」）。ホスト/DB名ガードは効くので事故にはならないが、原因が分かりにくい。
- **m3-02【新規・CONFIRMED】`docker compose exec backend npx jest` が壊れたことがどこにも書かれていない。** 修正としては正しいが、開発者には「テストが動かなくなった」としか見えない。README/TEST-PLAN に「テストはホスト側で `cd backend && npm test`」と明記すべき。
- **m3-03【新規・CONFIRMED】テスト名が実態と乖離。** `t97-response-hardening.test.ts` の `[既知の未修正: バグ再現テスト] … 現状FAIL` という名前のまま PASS するようになった。次に読む人が誤読する。
- **m3-04【新規・CONFIRMED】`validateSessionPatchPayload` に文字列長・未知キーの上限が無い。** `label` が非空文字列であることしか見ず、4MBの `label` が保存できる（`notes` には4000字上限があるのに非対称）。未知キーもJSONBに入る。
- **m3-05【ラウンド1見落とし・確度 疑い】レート制限の `Map` が無制限に増える。** IPを変えて叩けば1エントリ約100バイトが積み上がる。Render 無料枠で問題になる規模かは未計測。
- **m3-06【新規・確度 疑い】`JWT_SECRET` 変更の運用副作用が記録されていない。** ①本番の現行値が32文字未満なら**次のデプロイで起動不能**②値を変えると発行済みJWT（有効期限2h）が全部無効化され、**反省会当日にデプロイすると全員が再ログイン**を強いられる。デプロイ手順に「Render の JWT_SECRET が32文字以上か確認」を追記すべき。

---

## 確認したが問題が無かった領域

- **M-06 の構造検証 × 既存フロント — 問題なし。** frontend は `startSec = Math.floor(...)`（整数）で、追加後に全レグを再ラベルするため `label:""` は永続化前に必ず上書きされる。PATCH 呼び出しはこの1箇所のみで、`notes`/`marks` を送る経路は存在しない。
- **M-02 の select × frontend — 問題なし。** select 11項目が `SessionSummary` 型と1対1で完全一致。`VisibilityChip` が使う `visibility` も含まれる。落としたフィールドは無い。
- **410凍結の巻き込み — `users/me` 以外は問題なし。** frontend に `/api/sailors`・`/api/users/:username`・`/api/teams/:slug/{articles,questions}` の呼び出しはゼロ。`app.all("/api/users/:username/follow")` はセグメント数が違うため router の `/:username` に食われない。
- **`GET /api/teams/:slug` のメンバー判定に抜けなし。** 非メンバーとチーム不存在を**同一の404・同一ボディ**で返すため存在オラクルにならない。名簿は認可判定前に取得するがレスポンスには出ない。
- **`teamRole.ts` の2段呼び出し — 壊れていない。**
- **CI — 通る条件を満たしている。** postgres service は `5433:5432`、`.env.test` は `localhost:5433/sailvlog_test`。ホスト許可・DB名 `_test` 終端・`JWT_SECRET` 41文字をすべて満たす。`ensure-test-db.js` の admin 接続は差し替え前の `testUrl` に対してガードが掛かるので誤検知しない。（実行は未検証＝テストDBのTRUNCATEを伴うため意図的に見送り）
- **B-01 の3層ガード自体の論理 — 妥当。** 正当な実行経路（ホストからの `npm test`、CI）は全て通る。
- **`t01-frozen-routes.test.ts` — 新仕様と矛盾しない。** ログイン回数は1ファイルあたり最大2回でレート制限に触れない。
- **`boatTypes.ts` の wrap() — 正しい。** 艇種マスタは個人情報を含まないため未認証のままで妥当。
- **テストが実装に合わせて歪められていないか — 歪みは無い。** t95 は外形から検証しており実装の内部構造に依存していない。**問題はテストの質ではなく、テストが存在しない4コミット（M3-06）**。

---

## 良い点

1. **404統一で存在オラクルを潰したのは正しい判断。** 指摘された箇所（articles）だけでなく本体（`/:slug`）にも横展開している。
2. **B-02 で「認可を強くする」ではなく「機密境界を定義し直す」まで踏み込んだのが本質的。** 「register が誰でも通る以上、認証済みか≠部外者かどうか」という前提の崩れに正面から答え、**関係を定義できない機能は凍結する**と決めた（engineering-mindset「解く層は合っているか」）。
3. **`select` ホワイトリスト方式の採用理由が言語化されている。** 適用範囲が一覧だけに留まったのは M3-05 の指摘だが、規律の選択自体は正しい。
4. **fail-fast のエラーメッセージが「何が起きるか」まで書いている。** 秘密自体は出力していない。将来の自分が3秒で復旧できるメッセージになっている。

---

## Gate（③Quality Gate）への意見

**backend 単体として出荷可能か: 否（FAIL）。**

- **必須（これが直るまで出荷しない）: B3-01。** 7/31 の反省会は「部室に部員が集まって一斉にログインする」というシーンそのもので、現在の login レート制限はその条件で確実に人を弾く。しかも `public.ts` に「同じ罠を踏んで解決済み」という記録がある以上、見逃す言い訳が無い。修正は数行だが、**同時に回帰テストを1本要求する**。
- **出荷前に判断が必要: B3-02。** 「チーム加入はオーナーが手動投入する」と Team Lead が明示的に決めて TASKS.md に書けば Major に降格でよい。決めないまま出すと、当日「誰もセッションを作れない」で止まる。
- **同一スプリント内に直すべき: M3-01（1行の並べ替え＋テスト1本）、M3-03（新2値の追加）、M3-04（ADR-012 起票＝Team Lead管掌）。**
- **次スプリントでよい: M3-02、M3-05、Minor 6件。**
- **プロセス面の申し送り: M3-06 が今回の最大の構造的問題。** ラウンド1の指摘7件を6コミットで潰し、そのうち4コミットが無テスト。結果として無テストのコミット（M-04）が新しい Blocker を1個作った。**「修正コミットにもテストを付ける」を Quality Gate の通過条件に加えることを提案する。** REVIEW-backend-2 が書いていた「マウント済み全ルートを走査し、許可リスト以外は未認証で200を返さない」網羅テストがあれば、M3-01 の `PUT /me` 410 も自動で捕まっていた。

## 最も危険な指摘トップ3

1. **B3-01** — login レート制限が共有IP/プロキシで全員を巻き込む。反省会当日に全員ログイン不能。無テストで作り込まれた新規Blocker。
2. **M3-03** — `JWT_SECRET` ガードが、自分で新しく作ったリポジトリ公開値を通す。踏むと**認証機構が全面崩壊**（なりすまし・全チーム全データ）。確率は低いが被害は最大。
3. **B3-02** — チーム加入経路が存在せず、`GET /api/teams` 自チーム限定化で「壊れていることすら見えない」状態になった。7/31 に製品が動かない直接原因になり得る。
