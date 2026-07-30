# DESIGN-AUDIT — 正本ドキュメントとコード実態の整合監査（2026-07-27）

<!-- 契約: 作成者 architect / 入力: docs/dev-org/正本一式 + backend/src + frontend/src + design-system + git履歴 / 出力先: Team Lead（③Quality Gate再判定の参考）・implementer・qa-engineer・Codex -->
<!-- 位置づけ: 2026-07-27の大量並行実装（Team Lead / ルーチン / Codex / qa-engineer）で生じた正本⇔コードの乖離の棚卸し。本監査ではコード（frontend/src・backend/src）は一切変更していない。コード側の是正はTASKS.mdへ起票済み -->

対象: ブランチ `v3/replay-mvp`（監査開始時 HEAD=`309b035`、監査中に qa-engineer の `cfcc65c` が並行コミットされたため取り込んで再確認済み）。

## サマリ

- 検出した乖離・要記録事項: **23件**（既知2件を含む。うち正本修正で解消=9件、コード側タスク起票=2タスク6項目、ADR追加=3件、受容・記録のみ=6件、Team Lead申し送り=3件）
- **重大上位3件**: A-06（`publicViewCount` の部内API漏洩が一覧/作成/更新経路に残存＝ARCH §3の非KPI原則違反。qaが意図的FAILテストで固定済み）／A-03〜05（今日入った**外部契約・運用前提を変える3判断がADR未記録**だった→ ADR-009〜011で解消）／A-08（③Gate再判定の解除条件である Major 3件がタスク台帳（TASKS.md）に存在せず、完了追跡が GATES.md の文章にしか無かった→ T-29起票で解消）

## 監査結果一覧

凡例: 【済】=本監査で正本を修正済み ／【起票】=コード側タスクとして TASKS.md に登録 ／【記録】=乖離ではない・または受容（対応不要の根拠を記す）／【申送】=Team Lead判断待ち

### 1. 既知（監査前に裁定・修正済みの2件。前提として記載）

| # | 正本の記述 | コードの実態 | どちらが正か | 根拠 | 是正 |
|---|---|---|---|---|---|
| A-01 | UI-DESIGN §4.2（旧rev.4）「4色＋破線」 | 6色＋常時ラベル、破線はgaps専用 | **コード** | 破線は欠測表現と意味衝突（詳細はADR-008） | 裁定済み（ADR-008・UI-DESIGN rev.6・T-27） |
| A-02 | T-02要件 JWT_EXPIRES_IN=2h | `.env.example` が 7d | **正本** | ARCH §5（漏洩時の被害時間） | 修正済み（`e24c945`） |

### 2. ADRの欠落（今日の設計判断が無記録だった3件）→ ADR-009〜011 を追加

| # | 正本の記述 | コードの実態 | どちらが正か | 根拠 | 是正 |
|---|---|---|---|---|---|
| A-03 【済】 | ARCH §2/§5 は「auth/users/teams/sailors 既存流用」のまま。認証要否の変更が無記録 | Blocker R-01対応で `GET /api/teams`・`/:slug`・`/api/sailors`（一覧/詳細）・`/api/users/:username` を認証必須化（`t95`） | **コード**（外部契約の変更として正しい。文書が追随すべき） | SPEC §5.2「メンバー一覧は公開しない」の保証は系全体で成立させる必要（REVIEW R-01） | **ADR-009 新設**＋ARCH §5 にチェック項目追加 |
| A-04 【済】 | ARCH §4/SPEC §5.4「IPあたり60req/min」とだけ記述。IPの信頼モデルが無記録 | `x-forwarded-client-ip` は `x-internal-proxy-secret`（`INTERNAL_PROXY_SECRET`・timingSafeEqual）一致時のみ信用。未設定時は `req.ip` フォールバック | **コード**（運用前提=新env変数の追加。文書が追随すべき） | R-03。`publicViewCount` は共有2着手判定の実データであり偽装リスクを許容しない | **ADR-010 新設**＋ARCH §4 の該当行に注記。SPECは凍結文書のため触らない |
| A-05 【済】 | 非同期例外の安全網について正本に記述なし。`express-async-errors` 無断追加→却下の経緯もGATESの1行のみ | 依存ゼロの `wrap()`＋グローバルエラーハンドラ＋`process.on` 多重防御（`t96`） | **コード** | R-04。実装ルール6・ARCH §1「依存ゼロ」との整合。却下理由と擁護論を記録する価値がある判断 | **ADR-011 新設**＋ARCH §5 にチェック項目追加 |

### 3. 正本とコードの乖離（コード側を直すべきもの → 起票）

| # | 正本の記述 | コードの実態 | どちらが正か | 根拠 | 是正 |
|---|---|---|---|---|---|
| A-06 【起票】 | ARCH §3「`publicViewCount` は**APIにも画面にも出さない**」（SPEC §4-3・PRD §5-7 同旨） | R-02対応は `GET /api/sessions/:id` のみ。**`GET /api/sessions`（一覧）・`POST /api/sessions`・`PATCH /api/sessions/:id` のレスポンスには現在も含まれる**（select無しの findMany/create/update） | **正本** | 非KPI原則は製品判断。qa-engineer が `t97` に意図的FAILテストで固定済み（`cfcc65c`） | **T-28①**（implementer） |
| A-07 【起票】 | ADR-003（凍結）と ADR-009（認証必須化）の線引き | `GET /api/teams/:slug/articles`・`/:slug/questions` が未認証のまま残存（qa-engineer報告） | **正本**（architect裁定: **410凍結**が正。凍結機能のコンテンツ列挙であり、ADR-009の対象=現用閲覧系ではない） | ADR-003の機能単位凍結方針との一貫性 | **T-28②**＋ADR-009に残穴と裁定を追記 |
| A-08 【起票】 | GATES ③「Major 3件（R-03フロント半分・R-05・R-06）が未対応・Codex担当」 | 未実装（`publicSession.ts` はシークレット未同送・`!res.ok→null` のまま。トラック追加警告UIなし） | **正本**（未対応はGATESの認識どおり。問題はタスク台帳に無いこと） | ③Gate再判定の解除条件が追跡不能だった | **T-29 起票**（Codex担当・検証方法と仕様の正本参照を明記） |
| A-09 【起票】 | ADR-009（teams系は認証必須） | `frontend/src/lib/teamRole.ts` 冒頭コメントが「既存の**一般公開**エンドポイント」と記述（認証必須化後は虚偽） | **正本** | REVIEW R-01 提案②と同旨 | **T-29④**（コメントのみの修正） |

### 4. 正本間の矛盾・正本の陳腐化（正本側を修正した6件）

| # | 正本の記述 | コード/他正本の実態 | どちらが正か | 根拠 | 是正 |
|---|---|---|---|---|---|
| A-10 【済】 | ARCH §4「`POST /api/sessions` 入力 `{ title, type, ... }`」（typeが必須に読める） | `type` 省略可（既定 `practice`）。T-12検証結果に裁定記録あり | **コード** | ARCH §3自身が `@default(practice)` | ARCH §4 の表を `type?` に修正 |
| A-11 【済】 | ARCH §5「`.env.example` を両ディレクトリに整備」[x] | `frontend/.env.example` は存在しない（backend側のみ2026-07-26新設） | **コード**（実態） | T-02はwaive中の未完了タスク。文書が先走っていた | ARCH §5 を「backendのみ整備済み・frontend側はT-02残作業」に訂正 |
| A-12 【済】 | ARCH ADR-004（Vercel+Render+Neon） | `backend/.env.example` のコメントが Railway 前提（v1残骸） | **正本** | ADR-004で確定済み | `.env.example` のコメント2箇所を Render/Neon に修正（設定ファイルのためコード変更禁止の対象外と判断） |
| A-13 【済】 | TEST-PLAN §2「状態(2026-07-24時点)」列＝todoスキャフォールドのまま | todoは全て実テスト化 or 削除済み（`cfcc65c`）。現況 backend 12 suites・意図的FAIL 1件 | **コード** | git履歴・テスト実行 | §2直下に更新注記を追加（表自体はスナップショットとして保存） |
| A-14 【済】 | TEST-PLAN §6「`Session.visibility` がARCH §3に無い。追認要否確認を」 | ARCH §3 に記載済み（ADR-007で実効化） | 双方一致済み（申し送りが陳腐化） | ARCH §3 現行本文 | §6にクローズ注記を追加 |
| A-15 【済】 | TASKS T-27 が `[ ]`（未完了表示） | 成果物①②とも実施済み（`41608db`・検証記録つき）。監査時に `npx vitest run` 再実行で **6 files / 55 passed** を実測 | **コード** | コミット内容と現行コードの突き合わせ＋テスト実測 | T-27 を [x] に補完・検証結果を追記 |

### 5. TASKS.md の健全性（上記A-15以外）

| # | 内容 | 判断 | 是正 |
|---|---|---|---|
| A-16 【済】 | ブロッカー表の B-2 に waive の記載がなく、T-25 依存欄の「waive済み・上記参照」と不整合 | S2.5冒頭のwaive記録が正 | B-2行にwaive注記を追加 |
| A-17 【申送】 | GATES ③「Major R-02: 解消」— 実態は `GET /:id` のみの部分解消（A-06） | GATESはTeam Lead管掌のため本監査では編集しない | T-28完了後にGATES ③の R-02 行へ「一覧/作成/更新経路はT-28で完了」と追記することを推奨 |
| A-18 【記録】 | T-92 が `[ ]` のまま（検証=「SQLがNeon上で動く」がB-3ブロックで未達） | 現状のマークが正。ただしS3のwaive記録の対象一覧（T-02/T-17/T-23/T-24/B-2）に**T-92は含まれていない** | waive対象に加えるか、B-3解除まで未完了のまま扱うかはTeam Lead判断 |
| A-19 【申送】 | `.github/workflows/test.yml` のコメント「2026-07-27、auth.ts の型エラーが**Renderの初回デプロイ**で初めて露見」（`309b035`） | **T-02（デプロイ）はwaive中・オーナー同席条件のはず**だが、Renderへのデプロイが実施された形跡がある。TASKS T-02 の検証結果欄は空のまま | デプロイが実施されたなら T-02 の記録（cold start計測・E2E疎通）を埋める必要がある。実施の有無と許可経緯（GATES ①追記「デプロイは許可外」との整合）をTeam Leadが確認すること |
| — 【記録】 | T-90 は qa-engineer が本日 `[x]` 化（`cfcc65c`・実行ログつき） | 監査結論と一致（担当範囲完了・Q&A本文はT-91担当と定義済み）。二重編集は不要 | なし |

### 6. 乖離ではないと判定したもの（記録のみ・対応不要）

| # | 事項 | 判断根拠 |
|---|---|---|
| A-20 | `unpublish` が `publishedById` を残す（`publishedAt`/`publicSlug` のみnull化） | ARCH §3 の規定は「publishedAt: 取り消しでnullへ戻す」のみ。publishedById は「最後に昇格を実行した人」の履歴として残っても矛盾しない。仕様どおり |
| A-21 | 公開ペイロードの注釈に author 表示名が無い | SPEC §5.2 は「emailは除外・**表示名のみ可**」＝許可であって義務ではない。実装はより保守的（author自体を出さない）で、ホワイトリスト思想に合致 |
| A-22 | UI-DESIGN §2 の「navbar（v1流用）」表記 vs 実装は TopBar/BottomTabBar（T-26後） | 用語ドリフトだがレイアウト意図（上部バー/モバイル下部タブ）は §2 スマホ変形の記述と実装が一致。書き換えの利得が小さいため受容 |
| A-23 | SPEC §5.2「公開では `/api/tracks/:id/gpx` も**401/404**にする」vs ARCH/実装は一律404 | SPECは凍結文書（§11「以後この形で凍結」）。統合後の正本はARCH §4「未認証では404」で、実装（`authMiddlewareOr404`）と一致。REVIEW も「未認証に存在を教えない意図された使い分け」と確認済み |
| A-24 | 幽霊参照の走査結果 | docs/design-system/コード内の ADR 参照は ADR-001〜008（＋本監査で追加した009〜011）のみで全て実在。削除済み画面・タスクIDへの参照は履歴記録（検証結果欄・変更履歴）内のみで、現行仕様としての参照は無し。`spike/`・`design-system/`・mockups・research/ の参照パスも全て実在 |
| A-25 | ARCH §4「一覧はメタのみ」の表現 | 実装は notes/marks/legs 等も返すが、部内認証済み・同Team限定の情報であり秘匿要件はない。「メタのみ」は gridJson/rawGpx を含まない意図と解釈。T-28①のselect化の際に実態と表現が自然に一致する |

## 本監査で行った正本修正の一覧

- `docs/dev-org/ARCH.md` — ADR-009/010/011 追加、§4 `type?` 修正、§4 公開APIレート制限行にADR-010注記、§5 に2項目追加＋`.env.example` 記述の実態訂正、§8 DoD のADR件数を11件に更新、ADR-009に残穴裁定（410凍結）を追記
- `docs/dev-org/TASKS.md` — B-2 waive注記、T-27 完了マーク補完（vitest 55件PASS実測つき）、**T-28**（backend: publicViewCount全経路除外＋teams配下凍結漏れの410化）・**T-29**（Codex: R-03フロント/R-05/R-06/teamRole.tsコメント）を起票
- `docs/dev-org/TEST-PLAN.md` — §2 更新注記、§6 visibility申し送りのクローズ
- `backend/.env.example` — Railway残骸コメント2箇所を Render/Neon（ADR-004）に修正
- （編集しなかったもの: GATES.md=Team Lead管掌、REVIEW.md/REVIEW-backend-2.md=監査記録・作成中、SPEC-share1-phase1.md=凍結文書、design-system/=ADR-008確定済み、frontend/src・backend/src=全て起票のみ）

## 追記: REVIEW-backend-2.md（`c9f94df`・本監査と並行して完成）との対応関係

本監査の作業中に code-reviewer の第2次backend監査がコミットされた（独立に実施・相互参照なし）。重複指摘は次のとおり収束しており、**タスクの二重起票は不要**:

| REVIEW-backend-2 | 本監査 | 状態 |
|---|---|---|
| M-01（teams/:slug/articles・questions 未認証） | A-07 | **T-28②** で起票済み（裁定=410凍結。ADR-009追記とも一致） |
| M-02（一覧の publicViewCount 残存） | A-06 | **T-28①** で起票済み（qa `t97` のFAILテストとも収束） |
| M-03（共有シークレットのfrontend未実装） | A-08 | **T-29①** で起票済み |

B-01/B-02/M-04〜M-07/m-01〜m-06 は本監査のスコープ（正本⇔コードの乖離）外の新規指摘であり、トリアージと起票はTeam Lead/③Gateの管掌に委ねる。

## Team Lead への申し送り（判断が必要な3点）

1. **A-19**: Renderデプロイ実施の形跡（CI workflowコメント）と T-02 未記録の矛盾。デプロイの実施有無・許可経緯の確認と、実施済みなら T-02 検証結果の記入指示を
2. **A-17**: T-28 完了後、GATES ③ R-02 の「解消」記述に経路残存→T-28完了の経緯を追記することを推奨
3. **A-18**: T-92 を S3 waive 対象に含めるかの明示（現状はwaive一覧に無いまま未完了）
