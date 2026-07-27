// qa-engineer (T-90): 全テストファイル共通のグローバルフック(setupFilesAfterEnv)。
// 各testの前にDBを空にしてから開始する（前のtestが残したデータに依存する偽陽性/偽陰性を防ぐ）。
// 個別のテストファイルでさらに独自のbeforeEach/afterAllを足しても問題ない(併用可能)。
import { resetDb } from "../helpers/resetDb";
import prisma from "../../database";
import { awaitPendingBackgroundWork } from "../../routes/public";
import {
  _resetAuthRateLimiterForTests,
  _resetRateLimiterForTests,
  _resetViewThrottleForTests,
} from "../../lib/rateLimiter";

// qa-engineer (T-90 flaky調査 続報, 2026-07-28): resetDb()のデッドロックリトライ(helpers/resetDb.ts)
// だけでは説明できない、別種の失敗を追加で観測した——エラーが一切スローされず(グローバルエラー
// ハンドラのconsole.error出力なし)、それでいて「GET /api/teams(未認証)が401ではなく404」
// 「res.body.annotationがundefined」のように**応答の中身自体が想定と違う**ケース。
// これはデッドロック(例外を伴う)とは別のメカニズムで、次の説明と整合する:
//   routes/public.tsのGET /api/public/sessions/:slugは、閲覧数加算を
//   `prisma.session.update(...).catch(() => undefined)`としてawaitせずfire-and-forgetする
//   （T-31で頻繁に呼ばれる）。このPromiseがテスト関数のreturn後も実行中のまま残り、
//   次のtestのbeforeEach(=このTRUNCATE)がその後に発火すると、
//   ①デッドロックすれば例外(→resetDb側でリトライ済み)
//   ②デッドロックせず、TRUNCATE"後"に遅れてUPDATEが到達すれば、例外なく成功する。
//   RESTART IDENTITYで採番がリセットされた直後のテーブルに、古いテストのセッションIDを
//   指す更新が紛れ込むと、次のテストが作った別の行を意図せず書き換えうる
//   （例外は出ないため、症状は「なぜかデータの見え方がおかしい」という形でしか現れない）。
//
// implementer (2026-07-28): 100ms固定sleepでの緩和は「run 1で早速再現」し不十分と判明した
// （時間で待つのは負荷が上がれば必ず破れる）。本番のfire-and-forget設計はARCH.md/ADR-007どおり
// 維持しつつ、routes/public.tsに「今実行中のバックグラウンド処理」の集合を持たせ
// (awaitPendingBackgroundWork())、それが空になったこと(=状態)を確認してからTRUNCATEする。
// sleepではなく状態での待ち合わせなので、UPDATEが何ms掛かろうと取りこぼさない。
//
// implementer (2026-07-28): 実際に`npm test`を通したところ、上記2種の対策後も
// t12-sessions-api.test.tsで「TypeError: Cannot read properties of undefined (reading 'id')」
// が発生した（registerUser()がres.body.user.idを読む箇所）。調べると、これはDB汚染でも
// デッドロックでもない**第3の独立した原因**だった: lib/rateLimiter.tsのauthIpLimiter/
// authEmailLimiterはモジュールレベルのMapで、プロセス生存中ずっと状態を保持する
// （DBのTRUNCATEでは一切リセットされない）。register/loginを呼ぶテストファイルは
// t01/t12/t15/t30/t31/t95〜t100など多数あり、フルスイートを--runInBandで連続実行すると、
// 同一IP(supertestは127.0.0.1)からの合計リクエスト数が60秒の固定ウィンドウ内で
// authIpLimiterの上限(60回/60秒)を超え、どこかのファイルのregister/loginが例外なく
// 429を返す（→呼び出し側はuser.idが無いとTypeErrorになる、または期待したステータスと
// 食い違う）。t100-login-rate-limit.test.tsが自分のbeforeEachで
// _resetAuthRateLimiterForTests()を呼んでいたのは「自テスト内の判定を決定的にするため」
// であり、他ファイルとの間の汚染までは防げていなかった（グローバルなリセットが無かった）。
// これもDB行と同じ「テスト間で共有される可変状態」なので、resetDb()と対の関係として
// ここで毎テスト前に必ずリセットする（t31/t100内の個別リセット呼び出しは冗長になるが、
// 二重に呼んでも副作用は無い＝残しても壊れない）。
beforeEach(async () => {
  await awaitPendingBackgroundWork();
  await resetDb();
  _resetAuthRateLimiterForTests();
  _resetRateLimiterForTests();
  _resetViewThrottleForTests();
});

afterAll(async () => {
  await prisma.$disconnect();
});
