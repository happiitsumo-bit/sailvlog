"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { SessionSummary, TeamSummary } from "@/types";
import { VisibilityChip } from "@/components/VisibilityChip";
import { buildLoginRedirectUrl } from "@/lib/loginRedirect";
import { readLastTeamId, resolveAutoSelectedTeamId, writeLastTeamId } from "@/lib/teamSelection";

export default function SessionsPage() {
  return (
    <Suspense fallback={null}>
      <SessionsPageContent />
    </Suspense>
  );
}

function SessionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamIdParam = searchParams.get("teamId");

  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push(buildLoginRedirectUrl("/sessions", teamIdParam ? `?teamId=${teamIdParam}` : "")); return; }
    api
      .get<{ teams: TeamSummary[] }>("/api/teams")
      .then((r) => setTeams(r.teams))
      .catch(() => {})
      .finally(() => setTeamsLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // M-3(Issue #42): teamId未指定なら、直近の選択 or 所属1件のみのケースを自動選択してURLへ反映する。
  useEffect(() => {
    if (teamIdParam || teams.length === 0) return;
    const autoTeamId = resolveAutoSelectedTeamId(teams.map((t) => t.id), readLastTeamId());
    if (autoTeamId !== null) router.replace(`/sessions?teamId=${autoTeamId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, teamIdParam]);

  useEffect(() => {
    if (!teamIdParam) { setSessions(null); return; }
    writeLastTeamId(Number(teamIdParam));
    setError(null);
    api
      .get<{ sessions: SessionSummary[] }>(`/api/sessions?teamId=${teamIdParam}`)
      .then((r) => setSessions(r.sessions))
      .catch((err) => setError(err instanceof Error ? err.message : "取得に失敗しました"));
  }, [teamIdParam]);

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-header-title">Sessions</h1>
        <p className="page-header-sub">部内で共有された練習・レースの再生セッション一覧。</p>
      </div>

      {teamsLoaded && teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⛵</div>
          <p className="empty-state-text">まだどのチームにも所属していません</p>
          <p style={{ fontSize: "0.85rem", color: "var(--fg-mute)", margin: "0.75rem 0 1.25rem" }}>
            練習・レースの記録を共有するには、まずチームを作るか招待コードで参加してください。
          </p>
          <Link href="/teams" className="btn btn-primary">チームを作る・参加する →</Link>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
            <select
              value={teamIdParam ?? ""}
              onChange={(e) => router.push(e.target.value ? `/sessions?teamId=${e.target.value}` : "/sessions")}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                color: "var(--fg)",
                fontSize: "0.9rem",
                fontFamily: "var(--font-body)",
                minWidth: 200,
              }}
            >
              <option value="">チームを選択</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <Link href="/sessions/new" className="btn btn-primary">+ Import GPX</Link>
          </div>

          {!teamIdParam && (
            <div className="empty-state">
              <div className="empty-state-icon">○</div>
              <p className="empty-state-text">チームを選択するとセッション一覧が表示されます</p>
            </div>
          )}
        </>
      )}

      {error && <p style={{ color: "var(--terra)", fontSize: "0.85rem" }}>{error}</p>}

      {sessions && sessions.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">○</div>
          <p className="empty-state-text">NO SESSIONS YET // 最初のセッションを取り込もう</p>
        </div>
      )}

      {sessions && sessions.length > 0 && (
        <div className="stagger">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              className="question-card"
              style={{ display: "block" }}
            >
              <h3 className="question-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                {s.title}
                <VisibilityChip visibility={s.visibility} />
              </h3>
              <div className="question-meta">
                <span>{s.type === "race" ? "レース" : "練習"}</span>
                <span>{new Date(s.startedAt).toLocaleString("ja-JP")}</span>
                {s.venue && <span>{s.venue}</span>}
                <span>{s._count.tracks}艇</span>
                <span>{s._count.annotations}件の注釈</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
