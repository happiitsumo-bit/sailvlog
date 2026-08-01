// T-32: 「公開する」ボタンの表示条件（uploader本人 or Team admin）のうち、Team admin判定を担う。
// バックエンドに「自分のteam roleを1回で返す」専用APIが無い（backend/は今回改修対象外）ため、
// 所属チーム限定（非メンバー404・ADR-012）の既存エンドポイント（GET /api/teams・GET /api/teams/:slug）を2段で叩いて代替する。
// uploaderId一致で済むケース（canManageSessionの多くのケース）ではこの関数自体を呼ばない設計にすること。
import { api } from "./api";
import { TeamDetail, TeamSummary } from "@/types";

/** 指定teamIdにおいて、userIdがTeam admin(role==="admin")かどうかを判定する。
    teamが見つからない・メンバーが見つからない場合は安全側でfalse。 */
export async function fetchIsTeamAdmin(teamId: number, userId: number): Promise<boolean> {
  try {
    const { teams } = await api.get<{ teams: TeamSummary[] }>("/api/teams");
    const team = teams.find((t) => t.id === teamId);
    if (!team) return false;

    const detail = await api.get<TeamDetail>(`/api/teams/${team.slug}`);
    const member = detail.members.find((m) => m.user.id === userId);
    return member?.role === "admin";
  } catch {
    // ネットワークエラー等では「押せるが失敗する」より安全側（ボタン非表示）に倒す
    return false;
  }
}
