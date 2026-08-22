import crypto from "crypto";
import { Router, Request, Response } from "express";
import prisma from "../database";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { wrap } from "../lib/asyncHandler";
import {
  peekJoinUserRateLimit,
  recordJoinUserFailure,
  peekJoinIpRateLimit,
  recordJoinIpFailure,
  checkCreateTeamUserRateLimit,
  checkCreateTeamIpRateLimit,
} from "../lib/rateLimiter";
import { Prisma } from "@prisma/client";

const router = Router();

// C-06修正（Issue #39）: 「最後の管理者を降格/削除させない」不変条件をSerializableトランザクション内で
// 検知したときに使う内部シグナル用エラー。ハンドラのcatchでHTTPステータスへ変換するためだけの型で、
// レスポンスボディには使わない。
class LastAdminGuardError extends Error {}
class MemberNotFoundError extends Error {}

// PostgreSQLのSerializable分離レベルは、count()→update()/delete()の間に割り込む同時実行を
// 書き込みスキュー（write skew）として検知するとトランザクションを中断する。Prismaはこれを
// P2034（"Transaction failed due to a write conflict or a deadlock"）として投げる。
function isSerializationFailure(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
}

// ADR-013決定2: 招待コードは暗号論的乱数。短い人間可読コード(6桁等)は却下——この鍵1つで
// 部員名簿(username/specialty/experienceYears)が開く(ADR-012)ため、総当たり可能な鍵長にしない。
// crypto.randomBytes(16).toString("base64url") で128bit・22文字（Node標準・新規npm依存なし、
// sessions.tsのgeneratePublicSlugと同じ考え方）。
function generateInviteCode(): string {
  return crypto.randomBytes(16).toString("base64url");
}

// ADR-013 §APIコントラクト: 非メンバーには常に404、メンバーだがadminでない場合は403
// （teams.ts既存のGET /:slugと同じ「存在オラクルを作らない」考え方をadmin専用系にも適用する）。
// invite取得/rotate/PATCHの3箇所で同型の判定が必要なので共通化する。
async function requireCallerAdmin(
  res: Response,
  slug: string,
  userId: number
): Promise<{ teamId: number } | null> {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return null;
  }
  const caller = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId: team.id } },
  });
  if (!caller) {
    // 存在するが自分がメンバーでない場合も404（team slugの存在オラクルにしない。既存GET /:slugと同じ方針）。
    res.status(404).json({ error: "Team not found" });
    return null;
  }
  if (caller.role !== "admin") {
    res.status(403).json({ error: "この操作にはチームのadmin権限が必要です" });
    return null;
  }
  return { teamId: team.id };
}

// B-02修正（2026-07-27, REVIEW-backend-2.md）: 以前は authMiddleware（=ログイン済みか）だけで
// 部員名簿を守っていたが、POST /api/auth/register が招待制でも承認制でもないため「ログイン済みか」は
// 「部外者かどうか」を全く弁別しない（登録1回で誰でもログイン済みになれる）。
// この機密境界は「認証済みか」ではなく「そのチームのメンバーという関係にあるか」なので、
// GET /api/teams は自分が所属するチームのみ、GET /api/teams/:slug は非メンバーには404（存在の有無を含め教えない）
// にする。判断理由は実装報告に記載（Team Lead申し送り）。

// GET /api/teams — 一覧（自分が所属するチームのみ）
router.get("/", authMiddleware, wrap(async (req: AuthRequest, res: Response) => {
  const { category, search } = req.query;

  const where: Record<string, unknown> = {
    members: { some: { userId: req.userId as number } },
  };
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: "insensitive" } },
      { university: { contains: String(search), mode: "insensitive" } },
      { region: { contains: String(search), mode: "insensitive" } },
    ];
  }

  // ADR-013決定4: findMany が select 無しだと全カラム（inviteCode含む）を返してしまう
  // （R-02/M-02と同型の欠陥）。「含めるものだけ列挙」のホワイトリストにする。
  const teams = await prisma.team.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      university: true,
      region: true,
      bio: true,
      category: true,
      logoUrl: true,
      createdAt: true,
      _count: {
        select: { members: true, articles: true, questions: true },
      },
    },
  });

  res.json({ teams, total: teams.length });
}));

// GET /api/teams/:slug — 詳細（部員名簿を含む。自分がメンバーであるチームのみ。非メンバーは404）
router.get("/:slug", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
  // ADR-013決定4: findUnique も select 無しだと inviteCode が一般メンバーのレスポンスに載る
  // （このチームのadminでなくても部員なら閲覧できてしまう＝ADR-012の機密境界を超えて漏洩する）。
  // ここも「含めるものだけ列挙」に揃える。
  const team = await prisma.team.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true,
      slug: true,
      name: true,
      university: true,
      region: true,
      bio: true,
      category: true,
      logoUrl: true,
      createdAt: true,
      members: {
        select: {
          id: true,
          role: true,
          joinedAt: true,
          userId: true,
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              specialty: true,
              experienceYears: true,
              boatType: { select: { name: true, slug: true } },
            },
          },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      },
      _count: {
        select: { articles: true, questions: true },
      },
    },
  });

  // チームが存在しない場合と、存在するが自分がメンバーでない場合を同じ404で返す
  // （「存在するが権限が無い」を教えるとteam slugの存在オラクルになるため。middleware/auth.tsの
  // authMiddlewareOr404と同じ考え方）。
  const isMember = team?.members.some((m) => m.user.id === req.userId) ?? false;
  if (!team || !isMember) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  res.json(team);
}));

const TEAM_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,98}[a-z0-9]$/;

// POST /api/teams — チーム作成。作成者が admin の TeamMember になる（ADR-013 §APIコントラクト）。
// 招待コードは作成時点で発行する（決定3の「遅延生成」は既存チームのバックフィルをしないことが目的で、
// 新規作成はここで最初から発行してよい）。
router.post("/", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId as number;
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  // M4-01修正（2026-08-01, REVIEW-4.md）: registerが開放制のため「認証済み」＝誰でも到達できる。
  // join/loginと違い成功自体が新規DB行を作る脅威なので、失敗時のみ消費するpeek/record分離ではなく
  // 呼ぶたびに1回消費するcheck()にする（register/checkRegisterRateLimitと同じ考え方）。
  // 上限値の根拠はlib/rateLimiter.tsのコメント参照（userId 5回/60分・IP 20回/60分）。
  if (!checkCreateTeamUserRateLimit(userId) || !checkCreateTeamIpRateLimit(ip)) {
    res.status(429).json({ error: "チーム作成の試行回数が多すぎます。しばらくしてから再度お試しください" });
    return;
  }

  const { name, slug, university, region, category } = req.body ?? {};

  if (typeof name !== "string" || !name.trim() || typeof slug !== "string") {
    res.status(400).json({ error: "name, slug は必須です" });
    return;
  }
  if (!TEAM_SLUG_RE.test(slug)) {
    res.status(400).json({ error: "slug は半角英小文字・数字・ハイフン（3文字以上）で指定してください" });
    return;
  }
  if (category !== undefined && !["university", "club", "professional"].includes(category)) {
    res.status(400).json({ error: "category が不正です" });
    return;
  }

  const slugClash = await prisma.team.findUnique({ where: { slug } });
  if (slugClash) {
    res.status(409).json({ error: "そのslugは既に使われています" });
    return;
  }

  // 衝突は128bit乱数のため理論上のみだが、sessions.tsのpublicSlug発行と同じ流儀で数回だけ再試行する。
  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await prisma.team.findUnique({ where: { inviteCode } });
    if (!clash) break;
    inviteCode = generateInviteCode();
  }

  const team = await prisma.$transaction(async (tx) => {
    const created = await tx.team.create({
      data: {
        name: name.trim(),
        slug,
        university: typeof university === "string" && university.trim() ? university.trim() : undefined,
        region: typeof region === "string" && region.trim() ? region.trim() : undefined,
        category: category ?? undefined,
        inviteCode,
        inviteCodeUpdatedAt: new Date(),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        university: true,
        region: true,
        bio: true,
        category: true,
        logoUrl: true,
        createdAt: true,
      },
    });
    await tx.teamMember.create({ data: { userId, teamId: created.id, role: "admin" } });
    return created;
  });

  res.status(201).json({ team, inviteCode });
}));

// POST /api/teams/join — 加入経路はこの1本のみ。ADR-013決定1: パスにslugを置かない
// （非メンバーが総当たりで「そのslugのチームが存在するか」を判定できる存在オラクルになるため）。
// 招待コードだけが鍵で、不正コードは404（403にすると「コードは違うが存在はする」という情報が漏れる）。
router.post("/join", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId as number;
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  // ADR-013決定5: userId単位10回/60秒＋IP単位30回/60秒、失敗時のみ消費（login/B3-01と同じpeek/record分離）。
  if (!peekJoinUserRateLimit(userId) || !peekJoinIpRateLimit(ip)) {
    res.status(429).json({ error: "参加試行回数が多すぎます。しばらくしてから再度お試しください" });
    return;
  }

  const inviteCode = typeof req.body?.inviteCode === "string" ? req.body.inviteCode : "";
  const team = inviteCode
    ? await prisma.team.findUnique({ where: { inviteCode }, select: { id: true, slug: true, name: true } })
    : null;

  if (!team) {
    recordJoinUserFailure(userId);
    recordJoinIpFailure(ip);
    res.status(404).json({ error: "招待コードが無効です" });
    return;
  }

  // 既にメンバーなら冪等に200（ADR-013 §APIコントラクト）。失敗ではないのでレート制限は消費しない。
  // m4-01修正（2026-08-01, REVIEW-4.md）: findUniqueで未加入と判定してからcreateする間に
  // 同時リクエスト（ダブルクリック）が割り込むと、両方とも「未加入」と判定し後着がTeamMemberの
  // 複合ユニーク制約(P2002)に当たってグローバルエラーハンドラで500になっていた。実際には
  // 加入は成功しているのに失敗と表示されるため、P2002だけを「既にメンバー」として握りつぶし、
  // 契約どおり冪等な200にする（他のPrismaエラーは握りつぶさずthrowしてグローバルハンドラに委ねる）。
  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId: team.id } },
  });
  if (!existing) {
    try {
      await prisma.teamMember.create({ data: { userId, teamId: team.id, role: "member" } });
    } catch (err) {
      const isDuplicateMember =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isDuplicateMember) throw err;
    }
  }

  res.json({ team: { id: team.id, slug: team.slug, name: team.name } });
}));

// GET /api/teams/:slug/invite — admin専用。未生成なら遅延生成する（ADR-013決定3。既存team=1もこれで運用に乗る）。
router.get("/:slug/invite", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
  const admin = await requireCallerAdmin(res, req.params.slug, req.userId as number);
  if (!admin) return;

  const team = await prisma.team.findUnique({ where: { id: admin.teamId }, select: { inviteCode: true } });
  let inviteCode = team?.inviteCode ?? null;
  if (!inviteCode) {
    inviteCode = generateInviteCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.team.findUnique({ where: { inviteCode } });
      if (!clash) break;
      inviteCode = generateInviteCode();
    }
    await prisma.team.update({
      where: { id: admin.teamId },
      data: { inviteCode, inviteCodeUpdatedAt: new Date() },
    });
  }

  res.json({ inviteCode });
}));

// POST /api/teams/:slug/invite/rotate — admin専用。旧コードは即無効になる（新しいユニーク値で上書きするため）。
router.post("/:slug/invite/rotate", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
  const admin = await requireCallerAdmin(res, req.params.slug, req.userId as number);
  if (!admin) return;

  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await prisma.team.findUnique({ where: { inviteCode } });
    if (!clash) break;
    inviteCode = generateInviteCode();
  }
  await prisma.team.update({
    where: { id: admin.teamId },
    data: { inviteCode, inviteCodeUpdatedAt: new Date() },
  });

  res.json({ inviteCode });
}));

// PATCH /api/teams/:slug/members/:userId — admin専用。ロール変更。
router.patch("/:slug/members/:userId", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
  const { role } = req.body ?? {};
  if (!["member", "ob", "admin"].includes(role)) {
    res.status(400).json({ error: "role は member/ob/admin のいずれかです" });
    return;
  }

  const admin = await requireCallerAdmin(res, req.params.slug, req.userId as number);
  if (!admin) return;

  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId)) {
    res.status(400).json({ error: "不正なuserIdです" });
    return;
  }

  // C-06修正（Issue #39）: ADR-013決定6の不変条件は「チームを管理不能にさせない」であり、
  // DELETEだけでは守れない。count()とupdate()の間にトランザクションが無いと、adminが2人のときに
  // 2つの降格リクエストが同時に来て両方が adminCount<=1 を通過し、adminが0人のチームが残りうる
  // （招待コード経由でしか復旧できないため外から直せない）。
  // Serializable分離レベルで count→update を1トランザクションに閉じ込め、
  // 同時実行が実際に競合した場合はPostgreSQL側がP2034（シリアライズ失敗）を返すので409として扱う。
  let updated;
  try {
    updated = await prisma.$transaction(
      async (tx) => {
        const target = await tx.teamMember.findUnique({
          where: { userId_teamId: { userId: targetUserId, teamId: admin.teamId } },
        });
        if (!target) return null;

        if (target.role === "admin" && role !== "admin") {
          const adminCount = await tx.teamMember.count({ where: { teamId: admin.teamId, role: "admin" } });
          if (adminCount <= 1) {
            throw new LastAdminGuardError();
          }
        }

        return tx.teamMember.update({
          where: { userId_teamId: { userId: targetUserId, teamId: admin.teamId } },
          data: { role },
          select: { id: true, userId: true, role: true, joinedAt: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    if (err instanceof LastAdminGuardError) {
      res.status(409).json({ error: "最後の管理者を降格することはできません" });
      return;
    }
    if (isSerializationFailure(err)) {
      res.status(409).json({ error: "他の更新と競合したため処理できませんでした。再度お試しください" });
      return;
    }
    throw err;
  }

  if (!updated) {
    res.status(404).json({ error: "指定されたメンバーが見つかりません" });
    return;
  }

  res.json({ member: updated });
}));

// DELETE /api/teams/:slug/members/:userId — admin、または自分自身（脱退）。
// ADR-013決定6: 対象が最後のadminなら409（自分自身の脱退であっても、チームを管理不能にはさせない）。
router.delete("/:slug/members/:userId", authMiddleware, wrap(async (req: AuthRequest, res: Response): Promise<void> => {
  const callerUserId = req.userId as number;
  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId)) {
    res.status(400).json({ error: "不正なuserIdです" });
    return;
  }

  const team = await prisma.team.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const caller = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: callerUserId, teamId: team.id } },
  });
  if (!caller) {
    // 非メンバーには常に404（team slugの存在オラクルにしない。既存GET /:slugと同じ方針）。
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const target = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: targetUserId, teamId: team.id } },
  });
  if (!target) {
    res.status(404).json({ error: "指定されたメンバーが見つかりません" });
    return;
  }

  const isSelf = callerUserId === targetUserId;
  if (!isSelf && caller.role !== "admin") {
    res.status(403).json({ error: "この操作にはチームのadmin権限が必要です" });
    return;
  }

  // C-06修正（Issue #39）: PATCH側と同型の非トランザクションな count→delete。
  // count()とdelete()をSerializable分離レベルの1トランザクションに閉じ込め、
  // 同時実行が実際に競合した場合はP2034（シリアライズ失敗）を409として扱う。
  try {
    await prisma.$transaction(
      async (tx) => {
        const freshTarget = await tx.teamMember.findUnique({
          where: { userId_teamId: { userId: targetUserId, teamId: team.id } },
        });
        if (!freshTarget) throw new MemberNotFoundError();

        if (freshTarget.role === "admin") {
          const adminCount = await tx.teamMember.count({ where: { teamId: team.id, role: "admin" } });
          if (adminCount <= 1) {
            throw new LastAdminGuardError();
          }
        }

        await tx.teamMember.delete({ where: { userId_teamId: { userId: targetUserId, teamId: team.id } } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    if (err instanceof MemberNotFoundError) {
      res.status(404).json({ error: "指定されたメンバーが見つかりません" });
      return;
    }
    if (err instanceof LastAdminGuardError) {
      res.status(409).json({ error: "最後の管理者は削除できません" });
      return;
    }
    if (isSerializationFailure(err)) {
      res.status(409).json({ error: "他の更新と競合したため処理できませんでした。再度お試しください" });
      return;
    }
    throw err;
  }

  res.status(204).send();
}));

const gone = (_req: Request, res: Response) => {
  res.status(410).json({ error: "このエンドポイントはv3ピボットにより凍結されました" });
};

// M-01修正（2026-07-27, REVIEW-backend-2.md）: /:slug/articles・/:slug/questions は
// 未認証のまま記事本文全文・投稿者名を返していた（R-01/B-02修正の取りこぼし）。
// ADR-003で /api/articles・/api/questions 本体は410凍結済みなので、同じデータへの別ドアである
// この2本も同じ方針（410 Gone）に揃える。frontendからの利用はゼロ（grep済み・ヒット0）。
router.all("/:slug/articles", gone);
router.all("/:slug/articles/*", gone);
router.all("/:slug/questions", gone);
router.all("/:slug/questions/*", gone);

export default router;
