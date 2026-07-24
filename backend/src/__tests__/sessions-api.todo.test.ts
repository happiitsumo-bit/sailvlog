// qa-engineer (T-90) 先回りスキャフォールド。
// T-10（Prismaスキーマ: Session/Track/Annotation）・T-12（セッションAPI）はまだ未着手。
// このファイルは「実装が上がったら何を検証するか」をARCH.md §4から1対1で書き下した設計書 兼
// 実行可能スケルトン。test.todo は失敗扱いにならずCIをグリーンに保ったまま、
// 未実装のテスト項目を可視化する（すり抜け防止: 一覧はTEST-PLAN.mdの対応表とも一致させること）。
//
// 実装が上がったら:
//   - beforeEach で team/user/session をfixtures経由で作成
//   - request(app).post("/api/sessions/:id/tracks").set("Authorization", `Bearer ${token}`).send(payload)
//   - fixtures/trackPayloads.ts のビルダーを使って各400ケースを送る
//   - test.todo(...) を実際の test(...) + expect(...) に差し替える
import * as _trackPayloads from "./fixtures/trackPayloads"; // ビルダー群がコンパイル可能なことの確認も兼ねる

describe("POST /api/sessions (T-12) — 実装待ちスキャフォールド", () => {
  test.todo("TeamMemberが作成すると201でsessionが返る");
  test.todo("非TeamMemberが作成しようとすると403");
  test.todo("未認証(JWTなし)は401");
  test.todo("必須項目欠落（title/type/startedAt/durationSec/teamId）は400");
});

describe("POST /api/sessions/:id/tracks 構造検証 (T-12, ARCH §4) — 実装待ちスキャフォールド", () => {
  test.todo("正常payload(validTrackPayload)は201で、gridJson/rawGpxを除いたメタのみ返す");
  test.todo("lat.length !== lon.length !== pointCount は400 (payloadWithLengthMismatch)");
  test.todo("latが[-90,90]範囲外は400 (payloadWithLatOutOfRange)");
  test.todo("lonが[-180,180]範囲外は400 (payloadWithLonOutOfRange)");
  test.todo("gapsの要素でend<startは400 (payloadWithGapStartAfterEnd)");
  test.todo("gapsのendがpointCount以上は400 (payloadWithGapEndOutOfBounds)");
  test.todo("gapsのstartが負は400 (payloadWithGapStartNegative)");
  test.todo("gaps=[[0,pointCount-1]]の境界ぎりぎり正常系は201 (payloadWithGapAtBoundary)");
  test.todo("startSec+pointCountがdurationSecを超えると400 (payloadExceedingDuration)");
  test.todo("gridJsonが2MB超は413または400 (payloadWithOversizedGridJson)");
  test.todo("rawGpxが5MB超は413または400 (payloadWithOversizedRawGpx)");
  test.todo("非TeamMemberのPOSTは403");
});

describe("GET/PATCH/DELETE /api/sessions/:id 認可 (T-12) — 実装待ちスキャフォールド", () => {
  test.todo("GET: 同TeamMemberは200でtracks(gridJson込み・rawGpx除外)とannotationsを取得できる");
  test.todo("GET: 非TeamMemberは403");
  test.todo("GET: 存在しないidは404");
  test.todo("DELETE: uploader本人は204でTrack/Annotationごとカスケード削除される");
  test.todo("DELETE: uploaderでもTeam adminでもない同TeamMemberは403");
  test.todo("PATCH: title/notes/marks/legsの更新が200で反映される");
});

describe("POST/PATCH/DELETE /api/sessions/:id/annotations (T-15, ARCH §4) — 実装待ちスキャフォールド", () => {
  test.todo("正常なtSec/bodyは201");
  test.todo("tSecがdurationSec範囲外は400 (annotationWithTSecOutOfRange)");
  test.todo("bodyが2000字超は400 (annotationWithBodyTooLong)");
  test.todo("非TeamMemberのPOSTは403");
  test.todo("PATCH/DELETE: author本人またはTeam adminのみ成功、それ以外は403");
});
