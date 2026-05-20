import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import { TeamDetail, TeamMember, TEAM_ROLE_LABEL, TEAM_CATEGORY_LABEL } from "@/types";
import { getAvatarColor } from "@/lib/utils";
import { ArticleSummary, Question } from "@/types";

const API_URL = process.env.API_URL ?? "http://backend:8000";

async function getTeam(slug: string): Promise<TeamDetail | null> {
  const res = await fetch(`${API_URL}/api/teams/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function getTeamArticles(slug: string): Promise<{ articles: ArticleSummary[]; total: number }> {
  const res = await fetch(`${API_URL}/api/teams/${slug}/articles?limit=5`, { cache: "no-store" });
  if (!res.ok) return { articles: [], total: 0 };
  return res.json();
}

async function getTeamQuestions(slug: string): Promise<{ questions: Question[]; total: number }> {
  const res = await fetch(`${API_URL}/api/teams/${slug}/questions?limit=5`, { cache: "no-store" });
  if (!res.ok) return { questions: [], total: 0 };
  return res.json();
}

function MemberGroup({ members, role }: { members: TeamMember[]; role: "admin" | "member" | "ob" }) {
  const filtered = members.filter((m) => m.role === role);
  if (filtered.length === 0) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <p style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
        {TEAM_ROLE_LABEL[role]} ({filtered.length})
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        {filtered.map((m) => {
          const color = getAvatarColor(m.user.username);
          return (
            <Link
              key={m.id}
              href={`/users/${m.user.username}`}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.7rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, textDecoration: "none", transition: "box-shadow 0.15s" }}
            >
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${color}22`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, flexShrink: 0 }}>
                {m.user.username[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--fg)" }}>@{m.user.username}</div>
                {m.user.boatType && (
                  <div style={{ fontSize: "0.68rem", color: "var(--fg-mute)", fontFamily: "var(--font-mono)" }}>{m.user.boatType.name}</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default async function TeamDetailPage({ params }: { params: { slug: string } }) {
  const [team, { articles, total: articleTotal }, { questions, total: questionTotal }] = await Promise.all([
    getTeam(params.slug),
    getTeamArticles(params.slug),
    getTeamQuestions(params.slug),
  ]);

  if (!team) {
    return (
      <div className="container">
        <p>チームが見つかりません。</p>
        <Link href="/teams">チーム一覧に戻る</Link>
      </div>
    );
  }

  return (
    <div className="container">
      {/* ヘッダー */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Link href="/teams" style={{ fontSize: "0.8rem", color: "var(--fg-mute)", textDecoration: "none", fontFamily: "var(--font-mono)" }}>
            Teams
          </Link>
          <span style={{ color: "var(--fg-dim)" }}>›</span>
          <span style={{ fontSize: "0.8rem", color: "var(--fg-dim)", fontFamily: "var(--font-mono)" }}>{team.slug}</span>
        </div>

        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.4rem" }}>
          {team.name}
        </h1>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", background: "rgba(107,142,90,0.12)", color: "var(--sage)", padding: "0.25rem 0.6rem", borderRadius: 4, fontWeight: 600 }}>
            {TEAM_CATEGORY_LABEL[team.category]}
          </span>
          {team.region && (
            <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--fg-dim)", padding: "0.25rem 0.6rem", background: "var(--paper-2, rgba(0,0,0,0.04))", borderRadius: 4 }}>
              {team.region}
            </span>
          )}
        </div>

        {team.bio && (
          <p style={{ color: "var(--fg-mute)", fontSize: "0.9rem", lineHeight: 1.7, maxWidth: 600 }}>
            {team.bio}
          </p>
        )}

        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--fg-dim)" }}>
          <span><strong style={{ color: "var(--fg)" }}>{team.members.length}</strong> members</span>
          <span><strong style={{ color: "var(--fg)" }}>{team._count.articles}</strong> articles</span>
          <span><strong style={{ color: "var(--fg)" }}>{team._count.questions}</strong> Q&amp;A</span>
        </div>
      </div>

      <div className="layout-two-col">
        <div>
          {/* メンバー */}
          <div className="section-head" style={{ marginBottom: "1rem" }}>
            <h2 className="section-head-title">Members</h2>
          </div>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.25rem", marginBottom: "2rem" }}>
            <MemberGroup members={team.members} role="admin" />
            <MemberGroup members={team.members} role="member" />
            <MemberGroup members={team.members} role="ob" />
            {team.members.length === 0 && (
              <p style={{ color: "var(--fg-mute)", fontSize: "0.85rem" }}>メンバー情報はまだ登録されていません。</p>
            )}
          </div>

          {/* チームの記事 */}
          <div className="section-head">
            <h2 className="section-head-title">Articles</h2>
            {articleTotal > 5 && (
              <span style={{ fontSize: "0.78rem", color: "var(--fg-mute)", fontFamily: "var(--font-mono)" }}>
                +{articleTotal - 5} more
              </span>
            )}
          </div>
          {articles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">▲</div>
              <p className="empty-state-text">NO ARTICLES YET</p>
            </div>
          ) : (
            <div className="stagger">
              {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          )}

          {/* チームのQ&A */}
          <div className="section-head" style={{ marginTop: "2rem" }}>
            <h2 className="section-head-title">Q&amp;A</h2>
            {questionTotal > 5 && (
              <span style={{ fontSize: "0.78rem", color: "var(--fg-mute)", fontFamily: "var(--font-mono)" }}>
                +{questionTotal - 5} more
              </span>
            )}
          </div>
          {questions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">?</div>
              <p className="empty-state-text">NO QUESTIONS YET</p>
            </div>
          ) : (
            <div className="stagger">
              {questions.map((q) => {
                const hasAccepted = q.answers.some((a) => a.isAccepted);
                return (
                  <Link
                    key={q.id}
                    href={`/questions/${q.id}`}
                    className="question-card"
                    style={{ display: "grid", borderLeft: hasAccepted ? "3px solid var(--sage)" : undefined, paddingLeft: hasAccepted ? "calc(1.5rem - 3px)" : undefined }}
                  >
                    <div className="question-metrics">
                      <div className="q-metric">
                        <div className={`q-metric-value ${hasAccepted ? "accepted" : q._count.answers > 0 ? "has-answers" : ""}`}>
                          {q._count.answers}
                        </div>
                        <div className="q-metric-label">Ans</div>
                      </div>
                      <div className="q-metric">
                        <div className="q-metric-value">{q._count.votes}</div>
                        <div className="q-metric-label">Votes</div>
                      </div>
                    </div>
                    <div className="question-main">
                      <h3 className="question-title">{q.title}</h3>
                      <p className="question-body">{q.body.slice(0, 100)}{q.body.length > 100 ? "…" : ""}</p>
                      <div className="question-meta">
                        {q.boatType && <span style={{ color: "var(--terra)" }}>● {q.boatType.name}</span>}
                        <span>@{q.author.username}</span>
                        {hasAccepted && <span className="accepted-pill">Solved</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* サイドバー */}
        <aside className="sidebar">
          {team.university && (
            <div className="sidebar-section">
              <p className="sidebar-title">大学</p>
              <p style={{ fontSize: "0.9rem", color: "var(--fg)" }}>{team.university}</p>
            </div>
          )}
          <div className="sidebar-section">
            <p className="sidebar-title">カテゴリ</p>
            <p style={{ fontSize: "0.9rem", color: "var(--fg)" }}>{TEAM_CATEGORY_LABEL[team.category]}</p>
          </div>
          {team.region && (
            <div className="sidebar-section">
              <p className="sidebar-title">地域</p>
              <p style={{ fontSize: "0.9rem", color: "var(--fg)" }}>{team.region}</p>
            </div>
          )}
          <div className="sidebar-section">
            <Link href="/teams" style={{ fontSize: "0.82rem", color: "var(--terra)", fontFamily: "var(--font-mono)" }}>
              ← チーム一覧
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
