// T-90 (qa-engineer): REVIEW.md「テスト・CIの評価」#2・#3の追加分。
// R-05: 公開中セッションに後から追加したトラック/注釈編集が、再同意なしで即座に外へ出る問題。
//   TASKS.md 2026-07-26記載でTeam Lead裁定済み: backend側は現状維持（同意はUI側の一度きりの確認事項で、
//   永続化された同意フラグを持たない設計判断）。ここでは「現在の挙動」を仕様として固定する
//   （実装が正か誤りかの記録ではなく、意図せず変わったら気づけるようにする回帰テスト）。
// #3: unpublish→publishで前回のisPublic選択が引き継がれないことの固定（publish処理が
//   毎回全件isPublic=falseへ戻してから選択分のみtrueにする、という1行の挙動に安全性が依存している）。
import request from "supertest";
import app from "../index";
import prisma from "../database";

async function registerUser(tag: string): Promise<{ userId: number; token: string }> {
  const unique = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await request(app)
    .post("/api/auth/register")
    .send({ username: `u${unique}`.slice(0, 30), email: `${unique}@example.com`, password: "password123" });
  return { userId: res.body.user.id, token: res.body.token };
}

async function createTeam(tag: string) {
  return prisma.team.create({
    data: { slug: `team-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "T98テストチーム" },
  });
}

async function addMember(userId: number, teamId: number) {
  return prisma.teamMember.create({ data: { userId, teamId, role: "member" } });
}

async function createSessionAsMember() {
  const uploader = await registerUser("uploader");
  const team = await createTeam("s");
  await addMember(uploader.userId, team.id);
  const res = await request(app)
    .post("/api/sessions")
    .set("Authorization", `Bearer ${uploader.token}`)
    .send({ title: "第1回練習", type: "practice", startedAt: "2026-07-24T05:00:00.000Z", durationSec: 3600, teamId: team.id });
  return { sessionId: res.body.session.id as number, teamId: team.id, uploader };
}

describe("R-05: 公開中セッションへの追加トラック/注釈の即時反映（現行仕様の固定）", () => {
  test("公開後に追加したトラックは、昇格ダイアログを経由せず即座に公開ペイロードへ現れる", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const publishRes = await request(app)
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "初回公開分" });
    const slug = publishRes.body.publicSlug as string;

    // 公開後にトラックを追加(再同意フローなし)
    const trackRes = await request(app)
      .post(`/api/sessions/${sessionId}/tracks`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({
        boatLabel: "追加艇 5555",
        startSec: 0,
        pointCount: 1,
        gridJson: { lat: [35.35], lon: [139.5], gaps: [] },
        rawGpx: "<gpx>後から追加</gpx>",
      });
    expect(trackRes.status).toBe(201);

    const publicRes = await request(app).get(`/api/public/sessions/${slug}`);
    expect(publicRes.status).toBe(200);
    const boatLabels = publicRes.body.tracks.map((t: { boatLabel: string }) => t.boatLabel);
    expect(boatLabels).toContain("追加艇 5555");
  });

  test("公開後に追加した注釈は、publicAnnotationIdsで選択していなくても非公開のまま(isPublic=falseが既定)なので公開ペイロードに出ない", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const publishRes = await request(app)
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "初回公開分" });
    const slug = publishRes.body.publicSlug as string;

    const annotationRes = await request(app)
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 30, body: "公開後に追加した注釈(未選択)" });
    expect(annotationRes.status).toBe(201);
    expect(annotationRes.body.annotation.isPublic).toBe(false);

    const publicRes = await request(app).get(`/api/public/sessions/${slug}`);
    expect(JSON.stringify(publicRes.body)).not.toContain("公開後に追加した注釈");
  });
});

describe("unpublish→publish: 前回のisPublic選択の引き継ぎ (T-90 追加)", () => {
  test("再公開時に publicAnnotationIds を渡さないと、前回公開していた注釈もすべて非公開に戻る", async () => {
    const { sessionId, uploader } = await createSessionAsMember();
    const annotationRes = await request(app)
      .post(`/api/sessions/${sessionId}/annotations`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ tSec: 10, body: "1回目に公開した注釈" });
    const annotationId = annotationRes.body.annotation.id as number;

    const firstPublish = await request(app)
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "1回目", publicAnnotationIds: [annotationId] });
    expect(firstPublish.status).toBe(200);
    const afterFirst = await prisma.annotation.findUnique({ where: { id: annotationId } });
    expect(afterFirst?.isPublic).toBe(true);

    await request(app)
      .post(`/api/sessions/${sessionId}/unpublish`)
      .set("Authorization", `Bearer ${uploader.token}`);

    // 2回目の公開でpublicAnnotationIdsを渡さない(何も選ばない)
    const secondPublish = await request(app)
      .post(`/api/sessions/${sessionId}/publish`)
      .set("Authorization", `Bearer ${uploader.token}`)
      .send({ visibility: "unlisted", learningSummary: "2回目" });
    expect(secondPublish.status).toBe(200);

    const afterSecond = await prisma.annotation.findUnique({ where: { id: annotationId } });
    expect(afterSecond?.isPublic).toBe(false); // 前回選択が引き継がれていないことを固定

    const publicRes = await request(app).get(`/api/public/sessions/${secondPublish.body.publicSlug}`);
    expect(publicRes.body.annotations).toHaveLength(0);
  });
});
