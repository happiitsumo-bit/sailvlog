// Issue #35: 本番にログイン不要で見られるデモを1本置くための投入スクリプト。
//
// このスクリプト自体は「データ生成」のみを行う。本番DBへの実行はTeam Lead/オーナーが行うこと
// （ルーチンは本番に触らない。AGENTS.md「危険操作」参照）。
//
// 冪等: DEMO_PUBLIC_SLUG のセッションが既に存在すれば何もしない（再実行しても重複投入されない）。
//
// 実行例:
//   cd backend && DATABASE_URL="postgresql://..." npx ts-node scripts/seed-demo-session.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  DEMO_TEAM_SLUG,
  DEMO_TEAM_NAME,
  DEMO_PUBLIC_SLUG,
  DEMO_UPLOADER_EMAIL,
  buildDemoSessionData,
} from "../src/lib/demoData";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.session.findUnique({ where: { publicSlug: DEMO_PUBLIC_SLUG } });
  if (existing) {
    console.log(`✅ デモセッションは既に存在します（publicSlug=${DEMO_PUBLIC_SLUG}, id=${existing.id}）。何もしません。`);
    return;
  }

  const team = await prisma.team.upsert({
    where: { slug: DEMO_TEAM_SLUG },
    update: {},
    create: {
      slug: DEMO_TEAM_SLUG,
      name: DEMO_TEAM_NAME,
      category: "club",
      bio: "sailvlogのデモ用に作成された架空のチームです。実在の団体・個人とは関係ありません。",
    },
  });

  let uploader = await prisma.user.findUnique({ where: { email: DEMO_UPLOADER_EMAIL } });
  if (!uploader) {
    // ログイン用アカウントではないため、ランダムなパスワードを生成して捨てる（誰にも共有しない）。
    const randomPassword = crypto.randomBytes(24).toString("base64url");
    const hashedPassword = await bcrypt.hash(randomPassword, 12);
    uploader = await prisma.user.create({
      data: { username: "sailvlog-demo-uploader", email: DEMO_UPLOADER_EMAIL, hashedPassword },
    });
  }

  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: uploader.id, teamId: team.id } },
    update: {},
    create: { userId: uploader.id, teamId: team.id, role: "admin" },
  });

  const data = buildDemoSessionData();

  const session = await prisma.session.create({
    data: {
      ...data.session,
      teamId: team.id,
      uploaderId: uploader.id,
      visibility: "public",
      publicSlug: DEMO_PUBLIC_SLUG,
      publishedAt: new Date(),
      publishedById: uploader.id,
      tracks: { create: data.tracks },
    },
    include: { tracks: true },
  });

  const firstTrackId = session.tracks[0]?.id ?? null;

  for (const a of data.annotations) {
    await prisma.annotation.create({
      data: {
        sessionId: session.id,
        authorId: uploader.id,
        tSec: a.tSec,
        body: a.body,
        isPublic: true,
        trackId: firstTrackId,
      },
    });
  }

  console.log(`✅ デモセッションを作成しました: /p/${DEMO_PUBLIC_SLUG}（session id=${session.id}）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
