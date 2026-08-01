# VERIFY-T17-production — 本番URL上のE2E通し＋cold start実測

<!-- 契約: 作成者 qa-engineer / 対象: GitHub Issue #8 (T-17) ・ Issue #10 (T-24) / 提出先: Team Lead（③Quality Gate） -->
<!-- 実施日: 2026-08-01 / 対象環境: frontend https://sailvlog.vercel.app / backend https://sailvlog-rfxx.onrender.com -->

## 0. 結論（先出し）

**③Quality Gate の観点で出荷を止めるべき事象があった: YES。**
本番backend（Render）が **T-29/T-30（コミット `0df13bb`, 2026-08-01 16:59 JST）を含む最新コードをデプロイできていない**（`POST /api/teams` 等が404 = ルート自体が存在しない）。この結果、本タスクが検証すべき主要経路の大部分（チーム作成→招待→join→セッション作成→GPX投稿→注釈→公開/非公開、および性能実測 T-24）が**本番では実行不可能**だった。コードのバグではなく**デプロイ運用の欠落**（Render Auto-Deploy=Off・T-02で既知の制約）が原因。Team LeadによるRenderの手動再デプロイが必須。

---

## 1. スコープと実施可否サマリ

| # | 項目 | 結果 | 備考 |
|---|---|---|---|
| 1 | cold start実測 | **取得済み** | 12.5s → warm 0.33〜0.59s |
| 2 | `/api/health` 200 | PASS | |
| 3 | register → login → JWT取得 | PASS | JWT exp-iat=7200秒(2h)を確認 |
| 4 | チーム作成→招待コード→別アカウントjoin（T-30） | **FAIL（ブロック）** | `POST /api/teams` `POST /api/teams/join` とも404。本番未デプロイ |
| 5 | セッション作成→GPX投稿→取得 | **未実施（ブロック）** | チームが作れないため teamId が存在せず、`POST /api/sessions` を試す前提が成立しない |
| 6 | 公開昇格→未認証`/p/<slug>`→unpublish | **未実施（ブロック）** | 同上（公開できるセッションが存在しない）。存在しないslugへの404挙動のみ確認（PASS、§5参照） |
| 7 | 凍結ルート410 | PASS | articles/questions/sailors 全て410 |
| 8 | スマホ相当UA・画面幅の表示崩れ | PASS（簡易） | 390×844で `/login` `/sessions` `/handbook` を実ブラウザ確認。崩れなし |
| 9 | JSONB応答p95実測（T-24 / Issue #10） | **未実施（ブロック）** | セッションが作れないため計測対象が存在しない |
| 10 | テストデータ後始末 | **一部未完了** | テストユーザー2件が本番に残置（§7参照、API上に削除手段なし） |

**Issue #10（T-24）はクローズしない。** 依存関係（TASKS.md記載: 依存T-23=実データ投入）どおり、実データはおろか合成データでもセッションを作成する経路自体が本番で塞がれているため計測不能。

---

## 2. cold start実測（T-02の宿題）

このセッションでbackendへ最初に投げたリクエストで計測（事前ウォームアップ無し）。

```
$ date -u +"%Y-%m-%dT%H:%M:%SZ"
2026-08-01T08:04:27Z

$ curl -o /dev/null -s -w 'http_code=%{http_code} time_total=%{time_total} ttfb=%{time_starttransfer}\n' \
    https://sailvlog-rfxx.onrender.com/api/health
http_code=200 time_total=12.548474 ttfb=12.546558

# 直後の2回目・3回目（ウォーム状態）
$ curl -o /dev/null -s -w 'http_code=%{http_code} time_total=%{time_total} ttfb=%{time_starttransfer}\n' \
    https://sailvlog-rfxx.onrender.com/api/health
http_code=200 time_total=0.588030 ttfb=0.587434

$ curl -o /dev/null -s -w 'http_code=%{http_code} time_total=%{time_total} ttfb=%{time_starttransfer}\n' \
    https://sailvlog-rfxx.onrender.com/api/health
http_code=200 time_total=0.333436 ttfb=0.333137
```

**結果**: cold start = **12.5秒**、warm = **0.33〜0.59秒**。**判定: 実用上ギリギリ〜要注意**。反省会当日、最初にアクセスした部員は12秒待たされる（handbookに記載済みの「反省会前にURLを開いておく」対策の実効性の裏付けにはなったが、対策を知らない/忘れた部員には12秒の無応答は「壊れた」と誤認されうる長さ）。**FAILとまでは判定しないが、Quality Gateでの明示的なリスク受容（waive）記録を推奨**。

---

## 3. `/api/health` 200

```
$ curl -s https://sailvlog-rfxx.onrender.com/api/health
{"status":"ok","timestamp":"2026-08-01T08:04:39.986Z"}
http_code=200
```
**PASS**

---

## 4. register → login → JWT取得

テスト専用アカウントを2件新規作成（既存部員アカウントには一切触れていない）。メールアドレスはマスクせず記載するが**実在の部員とは無関係のテスト専用アドレス**（`qa-t17-*@example.com`、example.comは配送不能な予約ドメイン）。

```
$ curl -s -X POST https://sailvlog-rfxx.onrender.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"qa-t17-a-1785571514","email":"qa-t17-a-1785571514@example.com","password":"QaTest12345!"}'
{"user":{"id":3,"username":"qa-t17-a-1785571514","email":"qa-t17-a-1785571514@example.com","createdAt":"2026-08-01T08:05:16.772Z"},"token":"<masked>"}
http_code=201

$ curl -s -X POST https://sailvlog-rfxx.onrender.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"qa-t17-b-1785571514","email":"qa-t17-b-1785571514@example.com","password":"QaTest12345!"}'
{"user":{"id":4,"username":"qa-t17-b-1785571514","email":"qa-t17-b-1785571514@example.com","createdAt":"2026-08-01T08:05:27.274Z"},"token":"<masked>"}
http_code=201
```

user id が3・4だった＝**本番Userテーブルの実データはこの時点で2件のみ**（既存部員2名分と推定。DBには一切触っていないが実データ規模の傍証として記録）。

```
$ curl -s -X POST https://sailvlog-rfxx.onrender.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"qa-t17-a-1785571514@example.com","password":"QaTest12345!"}'
http_code=200
user: {'id': 3, 'username': 'qa-t17-a-1785571514', 'email': 'qa-t17-a-1785571514@example.com'}
```

JWT の `exp - iat`（取得トークンをbase64デコードして確認。値自体はマスク）:
```
iat: 1785571516  exp: 1785578716  exp-iat(sec): 7200
```
`JWT_EXPIRES_IN=2h` が本番で有効であることを確認。**PASS**

実ブラウザ（`https://sailvlog.vercel.app/login`、390×844モバイル幅）でも同アカウントでログイン→TopBarが`@qa-t17-a-1785571514`＋Logoutに切り替わることを確認（§6のスクリーンショット参照）。

---

## 5. チーム作成→招待コード→別アカウントjoin（T-30・本番初回実行）— **FAIL**

```
$ curl -s -X POST https://sailvlog-rfxx.onrender.com/api/teams \
  -H "Authorization: Bearer <token_a>" -H 'Content-Type: application/json' \
  -d '{"name":"QA T17 Team 1785571514","slug":"qa-t17-team-1785571514","category":"club"}'
<!DOCTYPE html>...<pre>Cannot POST /api/teams</pre>...
http_code=404
```

Express標準の「ルート未登録」404（アプリ内のカスタム404ハンドラではなく、`Cannot POST /api/teams` という文言がconnect/express由来のデフォルトエラー）。念のため既存ルート・新規ルート双方で切り分け:

```
$ curl -s -o /dev/null -w 'GET /api/teams http_code=%{http_code}\n' \
    -H "Authorization: Bearer <token_a>" https://sailvlog-rfxx.onrender.com/api/teams
GET /api/teams http_code=200          # 既存ルート（T-02時点で本番投入済み）は生きている

$ curl -s -H "Authorization: Bearer <token_a>" https://sailvlog-rfxx.onrender.com/api/teams
{"teams":[],"total":0}                 # このユーザーはどのチームにも所属していない（想定どおり）

$ curl -s -o /dev/null -w 'POST /api/teams/join http_code=%{http_code}\n' \
    -X POST -H "Authorization: Bearer <token_a>" -H 'Content-Type: application/json' \
    -d '{"inviteCode":"dummy"}' https://sailvlog-rfxx.onrender.com/api/teams/join
POST /api/teams/join http_code=404     # これも未登録
```

**切り分け結果**: `GET /api/teams`（既存機能）は200で正常応答。`POST /api/teams`・`POST /api/teams/join`（本日のコミット`0df13bb`でT-30として追加されたルート）だけが揃って404。**backend/src/routes/teams.ts のローカルコード上には該当ルートが実装済み**（本レポート作成前にファイルを直接確認済み）であり、コードの不備ではない。

**根本原因（推定・高確度）**: TASKS.md T-02の記録どおり、Renderは **Auto-Deploy=Off** で運用されている。直近のデプロイは2026-07-30（T-02完了時点）で止まっており、それ以降のコミット（T-28以降の一部、および本日16:59JSTの`0df13bb`＝T-29/T-30）が**本番に反映されていない**。articles/questions/sailorsの410化（T-28・07-27〜28のコミット）は本番で有効だったため、デプロイの断面はT-28完了〜T-29/T-30着手の間にあると推定される。

**この時点でチームが1つも作れないため、以下は全て未実施**:
- セッション作成（`POST /api/sessions` は `teamId` に所属チームが必要）
- GPXトラック投稿・取得
- 注釈CRUD
- 公開昇格（publish）→ 未認証`/p/<slug>`閲覧 → unpublish
- T-24（JSONB応答p95） — 計測対象のセッションが存在しない

**判定: FAIL（本番デプロイの構成問題。コード側の追加修正は不要、Team Leadによる本番再デプロイが必要）**

---

## 6. 凍結ルート410 / 未認証401 / フロントページ / モバイル表示

```
$ curl -s -o /dev/null -w 'http_code=%{http_code}\n' https://sailvlog-rfxx.onrender.com/api/articles
410
$ curl -s -o /dev/null -w 'http_code=%{http_code}\n' https://sailvlog-rfxx.onrender.com/api/questions
410
$ curl -s -o /dev/null -w 'http_code=%{http_code}\n' https://sailvlog-rfxx.onrender.com/api/sailors
410
$ curl -s -o /dev/null -w 'http_code=%{http_code}\n' https://sailvlog-rfxx.onrender.com/api/teams
401   # 未認証
```
**PASS**（3経路とも410、未認証`/api/teams`は401。ADR-012/ADR-009が本番で有効）

```
$ curl -s -o /dev/null -w '%{http_code}\n' https://sailvlog.vercel.app/
200
$ curl -s -o /dev/null -w '%{http_code}\n' https://sailvlog.vercel.app/login
200
$ curl -s -o /dev/null -w '%{http_code}\n' https://sailvlog.vercel.app/register
200
$ curl -s -o /dev/null -w '%{http_code}\n' https://sailvlog.vercel.app/handbook
200
$ curl -s -o /dev/null -w '%{http_code}\n' https://sailvlog.vercel.app/sessions
200
$ curl -s -o /dev/null -w '%{http_code}\n' https://sailvlog.vercel.app/p/nonexistent-slug-qa-test
404
$ curl -s https://sailvlog-rfxx.onrender.com/api/public/sessions/nonexistent-slug-qa-test
{"error":"セッションが見つかりません"}
http_code=404
```
**PASS**（存在しない公開slugはfrontend/backendとも一律404。ADR-007の「存在オラクルを作らない」仕様が本番で機能）

**モバイル表示（390×844、iPhone相当幅、実ブラウザ・claude-in-chrome操作）**:
- `/login`: フォーム・ボタンとも画面内に収まり、下部ナビ（Sessions/Handbook）と重ならず表示。崩れなし
- `/sessions`（qa-t17-aでログイン後）: 「チームを選択」ドロップダウンが空（所属チームなし＝§5のブロックと整合）。レイアウト自体は崩れなし
- `/handbook`: 見出し・番号付きリスト・リンクとも折り返し正常。TopBarが`@qa-t17-a-1785571514`＋Logoutで正しく認証状態を表示

**判定: PASS（簡易確認の範囲）**。ただし`/sessions/[id]`（再生ページ・注釈UI・タイムライン等、モバイル対応の本丸=T-25の対象）は§5のブロックにより**未確認**。T-25の検証結果（TASKS.md記載）はPlaywrightのiPhone 13エミュレーションによる代替計測であり、実機・本番環境双方の検証はまだ無い。

---

## 7. テストデータの後始末

| 作成物 | 内容 | 後始末 |
|---|---|---|
| Userレコード | `qa-t17-a-1785571514`（id=3）／`qa-t17-b-1785571514`（id=4） | **未完了**。backendに自己アカウント削除・admin向けユーザー削除のAPIが存在しない（`grep`で確認済み、`DELETE /api/users/...`相当は無し）。パスワードはテスト専用の使い捨て値で、既存部員のデータとは無関係だが、**本番Userテーブルに2件残留**する |
| Team / Session / Track / Annotation | 作成試行したが§5のブロックにより**1件も作成できていない** | 該当なし（そもそも存在しない） |

**本番DBへの直接操作（`DATABASE_URL`経由のSQL等）は制約により一切行っていない。** 残留ユーザー2件の削除が必要な場合、Team Lead経由でNeonの直接操作、またはbackendにユーザー削除APIを新設する判断が必要（後者は新規タスク）。

---

## 8. 発見事項のまとめ（Team Leadへ）

1. **【最重要】Renderの本番backendが最新コミットを反映していない。** `POST /api/teams`・`POST /api/teams/join`が404＝T-29/T-30が未デプロイ。T-02のAuto-Deploy=Off設定により、`prisma migrate deploy`同様デプロイも都度手動実行が必要という運用が、今回明確に事故（未反映のまま「本番で初めて動かす」想定のタスクを迎えた）につながった。**Team Leadに手動再デプロイを依頼し、再デプロイ後に本レポートの§5〜§9（未実施項目）を再実施する必要がある。**
2. cold start = 12.5秒はhandbookの「反省会前にURLを開いておく」対策が前提として機能する必要がある値。対策を怠った初回アクセスは「壊れて見える」リスクが残る。数値のwaive記録をGATES.mdに残すことを推奨。
3. Issue #10（T-24）は**クローズしない**。TASKS.mdの依存関係（T-23実データ投入待ち）どおり、実データはおろかどんなデータでもセッションを作る経路自体が塞がれているため、現時点では計測不能というだけでなく「未着手」に等しい。
4. テストユーザー2件（id=3, 4）が本番Userテーブルに残留。実害は無い（チーム非所属・パスワードはテスト専用）が、ユーザー削除経路が存在しないというプロダクト上の穴（部員が退部時にアカウントを消せない）も同時に見つかった。将来タスクとして起票を検討されたい。

---

## 9. 再実施が必要な項目（Render再デプロイ後）

- チーム作成→招待コード取得→別アカウントjoin（T-30の本番初回実行）
- セッション作成→GPXトラック投稿→取得（spike/gpxの合成データ流用）
- 注釈追加→公開昇格→未認証`/p/<slug>`閲覧→unpublish→再度非公開確認
- T-24: `GET /api/sessions/:id`（gridJson込み）応答時間10回計測・p95算出（Issue #10）
- 上記が全て通った時点で、`/sessions/[id]`のモバイル表示（再生UI）も併せて確認
