// Issue #29: 提出状況の可視化（DOM非依存の純関数。AGENTS.md制約5）。
// 「この練習に出た人」の定義に設計判断が要ると明記されていたため、
// 採用案（Issue #29着手コメントで事前記録済み）: チームの現メンバー全員を分母とし、
// 当該セッションにトラックを提出していないメンバーを「まだの人」として列挙する。
// 既知のトレードオフ: その日乗っていない部員も一時的に「未提出」に見える
// （「今日は乗っていない」を選べるオプトアウトは今回スコープ外＝YAGNI）。
import { TeamMember } from "@/types";

export interface SubmissionStatus {
  submittedCount: number;
  totalCount: number;
  /** 航跡を出していないチームメンバー（本人を除く）。 */
  missingMembers: TeamMember[];
}

/** チームメンバー一覧とこのセッションのtrack.uploaderId群から提出状況を求める。
    uploaderId が null/undefined のtrack（本Issue以前に作られた既存行）は誰の提出かも分からないため、
    分母(totalCount)にも分子(submittedCount)にも影響しない（安全側＝過大にsubmitted扱いしない）。 */
export function computeSubmissionStatus(
  teamMembers: TeamMember[],
  trackUploaderIds: (number | null | undefined)[]
): SubmissionStatus {
  const submittedUserIds = new Set(trackUploaderIds.filter((id): id is number => typeof id === "number"));
  const missingMembers = teamMembers.filter((m) => !submittedUserIds.has(m.user.id));
  return {
    submittedCount: teamMembers.length - missingMembers.length,
    totalCount: teamMembers.length,
    missingMembers,
  };
}
