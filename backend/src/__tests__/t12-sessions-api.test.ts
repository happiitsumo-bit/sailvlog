// T-12: セッションAPI（Express）のsupertest。
// ARCH.md §4のセッション/トラック系エンドポイント（annotations系はT-15の担当・対象外）。
// フィクスチャは qa-engineer 用意の fixtures/trackPayloads.ts をそのまま使う。
import request from "supertest";
import { setupTestServer } from "./helpers/testServer";
import prisma from "../database";
import {
  validTrackPayload,
  payloadWithLengthMismatch,
  payloadWithLatOutOfRange,
  payloadWithLonOutOfRange,
  payloadWithGapStartAfterEnd,
  payloadWithGapEndOutOfBounds,
  payloadWithGapStartNegative,
  payloadWithGapAtBoundary,
  payloadExceedingDuration,
  payloadWithOversizedGridJson,
  payloadWithOversizedRawGpx,
} from "./fixtures/trackPayloads";

const getServer = setupTestServer();

async function registerUser(tag: string): Promise<{ userId: number; token: string }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await request(getServer())
    .post("/api/auth/register")
    .send({ username: `u${unique}`.slice(0, 30), email: `${unique}@example.com`, password: "password123" });
  return { userId: res.body.user.id, token: res.body.token };
}

async function createTeam(tag: string) {
  return prisma.team.create({
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T12テストチーム" },
  });
}

async function addMember(userId: number, teamId: number, role: "member" | "admin" = "member") {
  return prisma.teamMember.create({ data: { userId, teamId, role } });
}

function validSessionBody(teamId: number, overrides: Record<string, unknown> = {}) {
  return {
    title: "第1回練習",
    type: "practice",
    startedAt: "2026-07-24T05:00:00.000Z",
    durationSec: 7200,
    teamId,
    ...overrides,
  };
}

async function createSessionAsMember(): Promise<{
  sessionId: number;
  teamId: number;
  uploader: { userId: number; token: string };
  durationSec: number;
}> {
  const uploader = await registerUser("uploader");
  const team = await createTeam("s");
  await addMember(uploader.userId, team.id);
  const res = await request(getServer())
    .post("/api/sessions")
    .set("Authorization", `Bearer ${uploader.token}`)
    .send(validSessionBody(team.id));
  return { sessionId: res.body.session.id, teamId: team.id, uploader, durationSec: res.body.session.durationSec };
}

describe("POST /api/sessions (T-12)", () => {
  test("TeamMemberが作成すると201でsessionが返る", async () => {
    const user = await registerUser("a");
    const team = await createTeam("a");
    await addMember(user.userId, team.id);

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(validSessionBody(team.id));

    expect(res.status).toBe(201);
    expect(res.body.session.title).toBe("第1回練習");
    expect(res.body.session.visibility).toBe("team");
  });

  test("非TeamMemberが作成しようとすると403", async () => {
    const user = await registerUser("b");
    const team = await createTeam("b");
    // addMemberしない

    const res = await request(getServer())
      .post("/api/sessions")
      .set("Authorization", `Bearer ${user.token}`)
      .send(validSessionBody(team.id));

    expect(res.status).toBe(403);
  });

  test("未認証(JWTなし)は401", async () => {
    const team = await createTeam("c");
    const res = await request(getServer()).post("/api/sessions").send(validSessionBody(team.id));
    expect(res.status).toBe(401);
  });

  // type は Prisma側 @default(practice) のため任意項目（省略時は practice になる。ARCH.md §3）。
  // 必須なのは title/startedAt/durationSec/teamId。
  test.each(["title", "startedAt", "durationSec", "teamId"])(
    "必須項目欠落（%s）は400",
    async (field) => {
      const user = await registerUser("d");
      const team = await createTeam("d");
      await addMember(user.userId, team.id);
      const body: Record<string, unknown> = validSessionBody(team.id);
      delete body[field];

      const res = await request(getServer())
        .post("/api/sessions")
        .set("Authorization", `Bearer ${user.token}`)
        .send(body);

      expect(res.status).toBe(400);
    }
  );
});

describe("POST /api/sessions/:id/tracks 構造検証 (T-12, ARCH §4)", () => {
  test("正常payload(validTrackPayload)は201で、gridJson/rawGpxを除いたメタのみ返す", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(validTrackPayload());

    expect(res.status).toBe(201);
    expect(res.body.track.gridJson).toBeUndefined();
    expect(res.body.track.rawGpx).toBeUndefined();
    expect(res.body.track.boatLabel).toBe("4423 田中/佐藤");
  });

  test("lat.length !== lon.length !== pointCount は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(payloadWithLengthMismatch());
    expect(res.status).toBe(400);
  });

  test("latが[-90,90]範囲外は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(payloadWithLatOutOfRange());
    expect(res.status).toBe(400);
  });

  test("lonが[-180,180]範囲外は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(payloadWithLonOutOfRange());
    expect(res.status).toBe(400);
  });

  test("gapsの要素でend<startは400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(payloadWithGapStartAfterEnd());
    expect(res.status).toBe(400);
  });

  test("gapsのendがpointCount以上は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(payloadWithGapEndOutOfBounds());
    expect(res.status).toBe(400);
  });

  test("gapsのstartが負は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(payloadWithGapStartNegative());
    expect(res.status).toBe(400);
  });

  test("gaps=[[0,pointCount-1]]の境界ぎりぎり正常系は201", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(payloadWithGapAtBoundary());
    expect(res.status).toBe(201);
  });

  test("startSec+pointCountがdurationSecを超えると400", async () => {
    const { sessionId, uploader, durationSec } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(payloadExceedingDuration(durationSec));
    expect(res.status).toBe(400);
  });

  test("gridJsonが2MB超は413", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(payloadWithOversizedGridJson());
    expect(res.status).toBe(413);
  }, 15000);

  test("rawGpxが5MB超は413", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(payloadWithOversizedRawGpx());
    expect(res.status).toBe(413);
  }, 15000);

  test("非TeamMemberのPOSTは403", async () => {
    const { sessionId } = await createSessionAsMember();
    const outsider = await registerUser("outsider");
    const res = await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${outsider.token}`)
      .send(validTrackPayload());
    expect(res.status).toBe(403);
  });
});

describe("GET/PATCH/DELETE /api/sessions/:id 認可 (T-12)", () => {
  test("GET: 同TeamMemberは200でtracks(gridJson込み・rawGpx除外)とannotationsを取得できる", async () => {
    const { sessionId, teamId, uploader } = await createSessionAsMember();
    await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(validTrackPayload());

    const member2 = await registerUser("member2");
    await addMember(member2.userId, teamId);

    const res = await request(getServer())
      .get(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${member2.token}`);

    expect(res.status).toBe(200);
    expect(res.body.tracks).toHaveLength(1);
    expect(res.body.tracks[0].gridJson).toBeDefined();
    expect(res.body.tracks[0].rawGpx).toBeUndefined();
    expect(res.body.annotations).toEqual([]);
  });

  test("GET: 非TeamMemberは403", async () => {
    const { sessionId } = await createSessionAsMember();
    const outsider = await registerUser("outsider2");
    const res = await request(getServer())
      .get(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
  });

  test("GET: 存在しないidは404", async () => {
    const { uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .get(`/api/sessions/999999`)
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(res.status).toBe(404);
  });

  test("DELETE: uploader本人は204でTrack/Annotationごとカスケード削除される", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    await request(getServer())
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send(validTrackPayload());

    const res = await request(getServer())
      .delete(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${uploader.token}`);
    expect(res.status).toBe(204);

    const remainingTracks = await prisma.track.findMany({ where: { sessionId } });
    expect(remainingTracks).toHaveLength(0);
  });

  test("DELETE: uploaderでもTeam adminでもない同TeamMemberは403", async () => {
    const { sessionId, teamId } = await createSessionAsMember();
    const other = await registerUser("otherMember");
    await addMember(other.userId, teamId, "member");

    const res = await request(getServer())
      .delete(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(res.status).toBe(403);
  });

  test("PATCH: title/notes/marks/legsの更新が200で反映される", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ title: "改題後", notes: "反省会メモ", marks: [{ label: "上", lat: 35.3, lon: 139.4 }], legs: [{ label: "L1", startSec: 0 }] });

    expect(res.status).toBe(200);
    expect(res.body.session.title).toBe("改題後");
    expect(res.body.session.notes).toBe("反省会メモ");
    expect(res.body.session.marks).toEqual([{ label: "上", lat: 35.3, lon: 139.4 }]);
  });

  // M-06修正（REVIEW-backend-2.md）: notes/marks/legsが以前は無検証で素通ししていた回帰テスト。
  test("PATCH: legs が配列でない場合は400（不正な形を保存させない）", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ legs: "L1" });

    expect(res.status).toBe(400);
  });

  test("PATCH: legs[].startSec が負の数の場合は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ legs: [{ label: "L1", startSec: -1 }] });

    expect(res.status).toBe(400);
  });

  test("PATCH: marks[].lat が範囲外の場合は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ marks: [{ label: "上", lat: 999, lon: 139.4 }] });

    expect(res.status).toBe(400);
  });

  test("PATCH: notes が文字列でない場合は400", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const res = await request(getServer())
      .patch(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ notes: { nested: "object" } });

    expect(res.status).toBe(400);
  });
});
