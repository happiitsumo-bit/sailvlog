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

/** このスクリプトが作ったデモ専用ユーザーであることの目印。 */
const DEMO_UPLOADER_USERNAME = "sailvlog-demo-uploader";

class SeedAbort extends Error {}

async function main() {
  // レビュー指摘（2026-08-04・PR #47）への対応:
  //   ① 全体が非トランザクションで、Session作成後にAnnotationで失敗すると
  //      publicSlugだけが残り、次回は「既に存在します」で終了して修復できなかった
  //   ② 固定メールの既存ユーザーを無条件に再利用し、デモチームのadminにしていた
  //      （先に同じメールで誰かが登録していると、そのアカウントに管理権限を渡す）
  //   ③ 固定slugの既存チームも所有確認なしに再利用していた
  // → 想定外の既存データがあれば **何も書き換えずに停止** し、
  //    作成は単一トランザクションで行う。
  const existing = await prisma.session.findUnique({
    where: { publicSlug: DEMO_PUBLIC_SLUG },
    include: { tracks: { select: { id: true } }, annotations: { select: { id: true } } },
  });
  if (existing) {
    const data = buildDemoSessionData();
    const complete =
      existing.tracks.length === data.tracks.length &&
      existing.annotations.length === data.annotations.length;
    if (complete) {
      console.log(`✅ デモセッションは既に存在します（publicSlug=${DEMO_PUBLIC_SLUG}, id=${existing.id}）。何もしません。`);
      return;
    }
    throw new SeedAbort(
      `デモセッション（id=${existing.id}）が不完全です: ` +
        `トラック ${existing.tracks.length}/${data.tracks.length}・` +
        `注釈 ${existing.annotations.length}/${data.annotations.length}。\n` +
        `トランザクション化前の実行で壊れた可能性があります。\n` +
        `内容を確認のうえ手動でこのセッションを削除してから再実行してください` +
        `（自動削除はしません。本番データを消す判断はスクリプトが持つべきではないため）。`
    );
  }

  // 専用ユーザー: メールが一致しても username が違えば「別人が先に取った」とみなして停止する
  const existingUser = await prisma.user.findUnique({ where: { email: DEMO_UPLOADER_EMAIL } });
  if (existingUser && existingUser.username !== DEMO_UPLOADER_USERNAME) {
    throw new SeedAbort(
      `メールアドレス ${DEMO_UPLOADER_EMAIL} は既に別のユーザー（username=${existingUser.username}, id=${existingUser.id}）が使っています。\n` +
        `このまま続行するとそのアカウントにデモチームの管理権限を与えてしまうため中止します。\n` +
        `DEMO_UPLOADER_EMAIL を変更するか、該当ユーザーを確認してください。`
    );
  }

  // 専用チーム: 既存slugがデモ用でない（デモユーザー以外のメンバーがいる）なら停止する
  const existingTeam = await prisma.team.findUnique({
    where: { slug: DEMO_TEAM_SLUG },
    include: { members: { select: { userId: true } } },
  });
  if (existingTeam) {
    const foreignMember = existingTeam.members.some((m) => m.userId !== existingUser?.id);
    if (foreignMember || !existingUser) {
      throw new SeedAbort(
        `チームslug ${DEMO_TEAM_SLUG} は既に存在し、デモ用と断定できません（id=${existingTeam.id}, メンバー${existingTeam.members.length}人）。\n` +
          `他人のチームを乗っ取らないため中止します。DEMO_TEAM_SLUG を変更してください。`
      );
    }
  }

  const data = buildDemoSessionData();
  // ログイン用アカウントではないため、ランダムなパスワードを生成して捨てる（誰にも共有しない）。
  // bcryptはトランザクション内で待たせたくないので先に計算しておく。
  const hashedPassword = await bcrypt.hash(crypto.randomBytes(24).toString("base64url"), 12);

  const sessionId = await prisma.$transaction(async (tx) => {
    const team =
      existingTeam ??
      (await tx.team.create({
        data: {
          slug: DEMO_TEAM_SLUG,
          name: DEMO_TEAM_NAME,
          category: "club",
          bio: "sailvlogのデモ用に作成された架空のチームです。実在の団体・個人とは関係ありません。",
        },
      }));

    const uploader =
      existingUser ??
      (await tx.user.create({
        data: { username: DEMO_UPLOADER_USERNAME, email: DEMO_UPLOADER_EMAIL, hashedPassword },
      }));

    await tx.teamMember.upsert({
      where: { userId_teamId: { userId: uploader.id, teamId: team.id } },
      update: {},
      create: { userId: uploader.id, teamId: team.id, role: "admin" },
    });

    const session = await tx.session.create({
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
      include: { tracks: { select: { id: true } } },
    });

    const firstTrackId = session.tracks[0]?.id ?? null;
    for (const a of data.annotations) {
      await tx.annotation.create({
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

    return session.id;
  });

  console.log(`✅ デモセッションを作成しました: /p/${DEMO_PUBLIC_SLUG}（session id=${sessionId}）`);
}

main()
  .catch((e) => {
    // 中止理由は運用者が読むものなので、スタックトレースではなく本文だけを出す
    if (e instanceof SeedAbort) console.error(`❌ 中止しました:\n${e.message}`);
    else console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
