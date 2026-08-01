# REVIEW-4.md — ③Quality Gate 再判定材料（T-29 / T-30）

<!-- 契約: 作成者 code-reviewer / 対象コミット 0df13bb（+ 3faf7f7 は docs のみ） / 判定材料: ③Quality Gate -->

- 対象: `v3/replay-mvp` `0df13bb`（T-29 フロント3件 + T-30 チーム加入API）。周辺の既存コード（`public.ts`・`sessions.ts`・`annotations.ts`・`rateLimiter.ts`）は差分の妥当性判定に必要な範囲で読んだ
- 日付: 2026-08-01 / レビュアー: code-reviewer（読み取りのみ。コードは一切変更していない）
- **Gate判定意見: FAIL（残り1件で解除可）** — Blocker 0 / Major 3 / Minor 7。FAIL理由は **M4-03 のみ**（③の通過条件そのものである「製品コード変更にテスト同梱」に抵触）。M4-01・M4-02 は Team Lead の受容記録で足りる性質

## 件数サマリ

| | Blocker | Major | Minor | 計 |
|---|---|---|---|---|
| T-30（backend チーム加入API） | 0 | 2 | 4 | 6 |
| T-29（frontend 公開ビュー残Major） | 0 | 1 | 3 | 4 |
| **計** | **0** | **3** | **7** | **10** |

## 重点観点の検証結果（依頼された6観点）

| # | 観点 | 結果 |
|---|---|---|
| 1 | 同型の漏洩（`select` 無し返却・`inviteCode` の露出） | **問題なし（CONFIRMED）**。`GET /api/teams`（teams.ts:76-93）・`GET /api/teams/:slug`（teams.ts:103-138）・`POST /api/teams`（teams.ts:198-217）はすべて明示 `select`。`grep` で backend 全体の `prisma.team.*` を洗い、`Team` 行を返す経路は teams.ts の3本と `public.ts:115`（`team: { select: { name: true } }`）のみ。`inviteCode` が乗る経路は `POST /api/teams` の作成者応答と `GET/POST /:slug/invite`（いずれも admin 本人）に限定されている |
| 2 | 招待コードの認可・存在オラクル | **API本体は問題なし**。`requireCallerAdmin`（teams.ts:26-49）で非メンバー404・非admin403に統一。不正コードは404（teams.ts:243）。最後のadminは DELETE 409 に加え **PATCH 降格も 409** で塞いである（teams.ts:325-331）。**ただし別経路で存在オラクルが1つ復活している → M4-02** |
| 3 | レート制限 | **設計は妥当（失敗時のみ消費・userId主/IP従）**。バケット単位も B3-01 の教訓（IP単位を主にしない）を踏襲。残る懸念は Minor 2件（m4-02・m4-03） |
| 4 | R-03 秘密の扱い | **問題なし（CONFIRMED）**。`INTERNAL_PROXY_SECRET` に `NEXT_PUBLIC_` は付いていない（`grep -rn "NEXT_PUBLIC" frontend/src` で確認）。`publicSession.ts` を import しているのは server component の `p/[slug]/page.tsx` のみでクライアントバンドルに入らない。未設定時はヘッダを積まない → backend が `req.ip` にフォールバック（public.ts:62-83）＝安全側 |
| 5 | R-06 の存在秘匿 | **問題なし**。404 のみ `notFound()`、それ以外は `PublicSessionUnavailableError`（publicSession.ts:36-47）。存在するslugでも存在しないslugでも 429/5xx 時は同じ「一時的に表示できません」画面なので、存在の有無は漏れない。`generateMetadata` 側にも同じ分岐を入れており「本文はOKだがメタデータ生成で500」の片肺状態を作っていない |
| 6 | トランザクション境界・競合 | **Minor 2件**（m4-01 同時join、m4-04 rotate競合）。チーム作成は `$transaction` で team+admin member を原子的に作っており、「adminのいないチーム」は生まれない |

## 検証コマンドと実測（レビュアー自身が実行）

```
cd backend && npx jest --runInBand   → Test Suites: 16 passed / Tests: 154 passed（45.9s）
cd frontend && npx vitest run        → Test Files 7 passed / Tests 59 passed（0.4s）
```

AGENTS.md のベースラインと一致。回帰なし。

---

## Blocker

**0件。** 過去2回の FAIL 理由（未認証での名簿列挙／共有IPでの全員ロックアウト／加入経路の不在）は、いずれもこのコミットで再発していない。とくに ADR-013 決定4 が名指しした「`select` 無しで `inviteCode` が一般メンバーに載る」同型事故は、コードでもテストでも塞がっている。

---

## Major

### M4-01 `POST /api/teams` に一切の流量制限がなく、公開本番でチーム行を無限生成できる

- 場所: `backend/src/routes/teams.ts:157-219`（`authMiddleware` のみ。`rateLimiter` の呼び出しが無い）
- 確度: **CONFIRMED**（コードパスを追って断定。`grep -n "RateLimit\|checkRate" backend/src/routes/teams.ts` のヒットは join の2行のみ）

**なぜ問題か**: `POST /api/auth/register` は招待制でも承認制でもない（ADR-012 で確認済みの前提）。したがって「認証済み」は誰でも1リクエストで到達できる状態であり、`POST /api/teams` は実質的に**未認証で開いているのと同じ流量特性**を持つ。`register` には IP 100回/60秒の蓋（M3-02）が、`join` には userId 10回/IP 30回の蓋があるのに、**新しくDB行を作る唯一の書き込み口だけが素通し**になっている。

**失敗シナリオ（入力→誤動作）**: 1. 攻撃者（またはバグったスクリプト）が `/api/auth/register` で1アカウント作る → 2. そのJWTで `POST /api/teams {name:"a", slug:"aaa0001"}` … `slug:"aaa9999"` をループ送信 → 3. 1リクエストあたり `Team` 1行 + `TeamMember` 1行が作られ、制限なく増え続ける → 4. Neon 無料枠（ストレージ/行数）を消費し、反省会当日に本来の書き込み（GPX取込）が失敗する。**現在 `main` は Vercel/Render で公開済み**なので、これは机上の脅威ではなく現に開いている口である。

**推奨する直し方（方針）**: `register`（IP単位・単純 `check()`）と同じ形で最低限の蓋をかける。総当たり対策ではなく DoS/スパムの頭打ちが目的なので、`userId` 単位（例: 5回/時）＋ IP 単位の緩い上限で十分。判断が割れるなら「チーム作成はオーナー運用（seed/管理者フラグ）に限定し、一般ユーザーには join だけ開く」も選択肢（ADR-013 のAPIコントラクトは作成を「認証済み」としているので、絞る場合は ADR 追記が必要）。

### M4-02 `POST /api/teams` の 409 が team slug の存在オラクルになり、ADR-012/013 が閉じた性質を再び開けている

- 場所: `backend/src/routes/teams.ts:173-177`
  ```ts
  const slugClash = await prisma.team.findUnique({ where: { slug } });
  if (slugClash) {
    res.status(409).json({ error: "そのslugは既に使われています" });
  ```
- 確度: **CONFIRMED**

**なぜ問題か**: ADR-012 は `GET /api/teams/:slug` を非メンバーに 404 にし、ADR-013 決定1 は `POST /api/teams/:slug/join` を却下した。どちらも理由は同一で「**非メンバーが slug の存在を判定できる経路を作らない**」である。ところが同じコミットで追加された作成APIが、201（存在しない）と 409（存在する）という完全な二値応答を返すため、その性質が破れている。

**失敗シナリオ**: 部外者が register 1回 → `POST /api/teams` に `slug:"nagasaki-u"` を送る → 409 なら「その団体はsailvlogを使っている」と確定できる。他大学名・高校名を辞書にして総当たりすれば、**どの団体が導入済みかの一覧**が作れる（M4-01 により回数制限もない）。名簿そのものは開かない（それには招待コードが要る）ので Blocker ではないが、ADR-013 帰結欄が「コードを知らない者はチームの存在すら観測できない」と明記した保証は**現状 成立していない**。

**推奨する直し方（方針）**: 3案。①409のまま受容し、**ADR-013 に「作成APIは slug 一意制約の性質上、存在の有無を返す。許容する」と明記**（最も安いが、ドキュメントの保証文言も直す必要あり）②M4-01 のレート制限を入れて辞書攻撃のコストを上げる（①と併用で実務上は十分）③slug をユーザー入力にせずサーバー生成にする（設計変更、S規模には過剰）。**どちらが正かはコードでなく ADR の記述の問題**なので、①+②を推し、ADR-013 の帰結欄を実態に合わせて更新するのが妥当と考える。

### M4-03 T-29 で入った新規フロント実装（約320行）のうち、R-05 の中核である「確認ダイアログを出す/出さない」の分岐に自動テストが1本もない

- 場所: `frontend/src/app/sessions/[id]/page.tsx:40-42`（`sessionIsPublished`）、`:428-434`（航跡追加の分岐）、`:474-481`（`requestAnnotationEdit`）。新規テストは `frontend/src/lib/__tests__/t29-public-session-status.test.ts`（4件）のみで、**R-06 のステータス判定しか検証していない**
- 確度: **CONFIRMED**（`grep -rn "sessionIsPublished\|pendingTrack\|requestAnnotationEdit" frontend/src` のヒットが page.tsx のみ＝テストからの参照ゼロ）

**なぜ問題か**: AGENTS.md 交渉不可の制約5／GATES ③の通過条件は「製品コードの変更にはテストを同梱する」。この条件は**ラウンド1で無テスト修正がB3-01を作り込んだ実測結果**から追加されたものであり、今回は R-05（プライバシー＝再同意なしの外部公開）という Gate の解除対象そのものが無テストで入っている。

**失敗シナリオ（将来の回帰が黙って通る）**: 誰かが `sessionIsPublished` の条件を `visibility === "public"` に「単純化」する → `unlisted`（限定公開URL）のセッションに航跡を追加しても警告が出なくなる → 部員が自宅→部室の陸上移動を含むGPXを無警告で追加し、限定公開URLを受け取った部外者にそれが見える → **テストは全部グリーンのまま**。R-05 が閉じたはずのプライバシー穴が再び開く。

**推奨する直し方（方針）**: DOM を触らずに済む形へ寄せる。`sessionIsPublished` と「警告を挟むか即実行か」の判定（`requestAnnotationEdit` の条件部分）を `lib/` 配下の純関数に切り出し、`t32-publish.test.ts` と同じ形式でユニットテストを3〜4本書く（`team`/`unlisted`/`public` × `isPublic` true/false）。RTL 導入（新規npm依存＝Team Lead承認）まで踏み込む必要はない。

---

## Minor

- **m4-01 同時 join（ダブルクリック）で 500 が返り、契約の「冪等200」が破れる** — `teams.ts:245-248` は `findUnique` で既存メンバーを確認してから `create` する。2リクエストが同時に来ると両方が「未加入」と判定し、後着が `TeamMember` の複合ユニーク制約に当たって P2002 → グローバルエラーハンドラで500。実際には加入は成功しているのに、ユーザーには「失敗しました」が出る（招待コードを渡された新入部員が最初に踏む操作なので、体験の入口で起きる）。方針: `create` を `try/catch` で P2002 のみ握り潰す、または `upsert` にする。
- **m4-02 join の IP バケット（30回/60秒）は部室の共有NATで全員に効く** — `teams.ts:222-228`。`app.set("trust proxy", 1)` があるので `req.ip` は実クライアントIPだが、B3-01 の教訓どおり**大学NAT/部室Wi-Fi配下は全員が同一グローバルIP**。新歓で20人が一斉にコードを打ち、打ち間違いが積み上がると30回に届き得る（失敗時のみ消費なので確率は低い＝Minor 止まり）。方針: 128bit のコードに対する総当たり耐性は userId 単位だけで十分に成立しているため、IP 側は 100 程度まで緩めるか、値の根拠をコメントに残す。
- **m4-03 ADR-013 決定5（レート制限）に回帰テストが無い** — `t103-team-join.test.ts` は14件あるが 429 を検証するものはゼロ（`_resetJoinRateLimiterForTests` を beforeEach で呼んでいるだけ）。`t102-register-rate-limit.test.ts` に前例があるので、同じ形で「11回目の不正コードが429」「成功はカウントを消費しない」の2本を足せば埋まる。
- **m4-04 `GET /:slug/invite` が副作用（コード生成＋UPDATE）を持つ GET** — `teams.ts:254-273`。ブラウザのプリフェッチや再試行で意図しない書き込みが走る。またadmin 2人が同時に初回アクセスすると、両者の生成が競合して片方の `update` が上書きされ、**先に画面に出た方のコードが即座に無効になる**（配った直後に「無効です」になる）。方針: 生成は `POST /:slug/invite`（または rotate に一本化）へ寄せ、GET は読むだけにする。
- **m4-05 1人チームは誰も抜けられず、削除もできない** — `teams.ts:365-371`（最後のadminは409）＋ `DELETE /api/teams` が存在しない。slug を打ち間違えて作ったチームは永久に残る（M4-01 のスパムと合わさると掃除手段が無い）。ADR-013 決定6 の帰結として妥当な副作用だが、**運用手段（オーナーがDBから消す）を TASKS か ADR に1行残す**のが望ましい。
- **m4-06 `x-forwarded-for` の先頭値を無検証で採用している** — `frontend/src/lib/publicSession.ts:59-64`。Vercel エッジが XFF を**上書き**するなら問題ないが、**追記**する実装なら、閲覧者が `x-forwarded-for: 1.2.3.4` を自分で付けるだけで転送値を汚染でき、ADR-010 が守りたかった「閲覧数の偽装ができない」が半分だけ破れる。確度: **PLAUSIBLE**（Vercel の実挙動をこの環境から確認していない）。**確認方法**: 本番へ `curl -H "x-forwarded-for: 203.0.113.9" https://<vercel-domain>/p/<slug>` を複数回投げ、backend 側の 429 が別バケット扱いになるか（＝偽装が効くか）を見る。効くなら `x-real-ip` を優先し、XFF は fallback にする。
- **m4-07 参照ADRのズレと、自ら書いた設計指針との不整合** — ①`frontend/src/lib/teamRole.ts:3` のコメントとコミットメッセージが「ADR-009に整合」と書いているが、ADR-009 は **ADR-012 で上書き済み**。現行契約は ADR-012（自チームのみ／非メンバー404）なので参照先を差し替えるべき。②同 `teamRole.ts:4` は「uploaderId 一致で済むケースではこの関数を呼ばない設計にすること」と自ら書いているのに、`sessions/[id]/page.tsx:152-156` は uploader 本人でも常に `fetchIsTeamAdmin`（＝API 2往復）を呼ぶよう変更された。注釈編集ボタンの表示条件に admin 判定が要るという理由は理解できるので**実装ではなくコメントの方を更新**するのが正だと考える。

---

## 良い点（何が良い判断だったかの言語化）

1. **「キー名の非存在」だけでなく「値の非出現」で漏洩を検査している** — `t103-team-join.test.ts:164,174` の `expect(JSON.stringify(list.body)).not.toContain(inviteCode)`。`not.toHaveProperty("inviteCode")` だけだと、将来ネストしたオブジェクト（例: `team.settings.code`）に値が回り込んだときにすり抜ける。値で検査する形は、同型事故を3回起こした系に対する**正しい抽象度の回帰ガード**になっている。
2. **警告の粒度が正しい** — 新規注釈は `isPublic` 既定 false（schema）なので警告を出さず、**既に公開されている注釈の編集時だけ**警告する（`page.tsx:477` の `sessionIsPublished(detail) && annotation.isPublic`）。全ミューテーションに警告を出す実装なら「警告疲れ」で誰も読まなくなる。R-05 の目的（再同意）を満たす最小限に絞れている。
3. **ADR に書かれていない不変条件を、規定の目的から演繹して塞いだ** — 最後の admin の保護を DELETE だけでなく PATCH 降格にも適用（`teams.ts:320-331`）。ADR-013 決定6 の文言は DELETE しか書いていないが、「チームを管理不能にしない」という目的からは降格も同型。**実装者の「ADR未規定なので報告のみ」という判断を Team Lead が覆した経緯がコメントに残っている**のも、後から読む人に判断根拠が伝わる良い記録。
4. **R-06 を `generateMetadata` 側にも同じ形で入れた** — 片方だけ直すと「本文は再試行案内、メタデータ生成で例外→500」という中途半端な壊れ方をする。両方に同じ分岐を置いたことで、429/5xx 時の挙動が1つに揃っている。
5. **R-03 の未設定時フォールバックが安全側** — シークレット未設定なら**ヘッダを積まない**（`publicSession.ts:74`）→ backend は `req.ip` を使う。「本番で環境変数を入れ忘れたら壊れる」ではなく「入れ忘れたら旧挙動に戻るだけ」であり、デプロイ手順の抜けが事故にならない。

---

## Team Lead 向けの判定材料まとめ

- **Blocker 0**。③の通過条件①（Blocker 0件）は満たしている
- **テストは実測グリーン**（backend 16/154・frontend 7/59。上記コマンド出力）。通過条件②も満たす
- **FAIL にすべきかの分岐点は M4-03 一点**。テスト同梱は「ラウンド1の失敗から自分たちで追加した通過条件」であり、ここを1回緩めると条件そのものが形骸化する。修正コストは純関数の切り出し＋ユニットテスト3〜4本で小さい
- **M4-01 / M4-02 は受容記録でも可**（いずれも「登録開放＋作成API」という組み合わせに由来し、根本は register の開放＝ADR-012 が将来課題として棚上げした論点）。受容する場合は ADR-013 帰結欄の「チームの存在すら観測できない」という保証文言を実態に合わせて訂正すること
