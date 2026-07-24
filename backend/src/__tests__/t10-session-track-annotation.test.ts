// T-10: Prismaスキーマ追加（Session/Track/Annotation）の create/read スモーク
import prisma from "../database";

describe("T-10 Session/Track/Annotation スキーマ", () => {
  test("3モデルのcreate/readが通り、visibilityがteamデフォルトになる", async () => {
    const boatType = await prisma.boatType.create({
      data: { name: "T10テスト艇種", slug: `t10-boat-${Date.now()}` },
    });
    const user = await prisma.user.create({
      data: {
        username: `t10user${Date.now()}`,
        email: `t10-${Date.now()}@example.com`,
        hashedPassword: "x",
        boatTypeId: boatType.id,
      },
    });
    const team = await prisma.team.create({
      data: { slug: `t10-team-${Date.now()}`, name: "T10テストチーム" },
    });

    const session = await prisma.session.create({
      data: {
        title: "第1回練習",
        startedAt: new Date("2026-07-24T05:00:00Z"),
        durationSec: 7200,
        teamId: team.id,
        uploaderId: user.id,
      },
    });
    expect(session.visibility).toBe("team");

    const track = await prisma.track.create({
      data: {
        sessionId: session.id,
        boatLabel: "4423 田中/佐藤",
        startSec: 0,
        pointCount: 3,
        gridJson: { lat: [35.1, 35.2, 35.3], lon: [139.1, 139.2, 139.3], gaps: [] },
        rawGpx: "<gpx></gpx>",
      },
    });

    const annotation = await prisma.annotation.create({
      data: {
        sessionId: session.id,
        authorId: user.id,
        tSec: 120,
        trackId: track.id,
        body: "タックが遅い",
      },
    });

    const read = await prisma.session.findUnique({
      where: { id: session.id },
      include: { tracks: true, annotations: true, team: true, uploader: true },
    });

    expect(read?.tracks).toHaveLength(1);
    expect(read?.tracks[0].id).toBe(track.id);
    expect(read?.annotations).toHaveLength(1);
    expect(read?.annotations[0].id).toBe(annotation.id);
  });
});
