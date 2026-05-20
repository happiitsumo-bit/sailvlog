import Link from "next/link";
import ClassFlag from "@/components/ClassFlag";
import ClassFocusTile from "@/components/ClassFocusTile";
import PickUpReference from "@/components/PickUpReference";
import IntelligenceFeed from "@/components/IntelligenceFeed";
import { BoatType, Question, TeamSummary } from "@/types";

const API_URL = process.env.API_URL ?? "http://backend:8000";

async function getBoatTypes(): Promise<BoatType[]> {
  const res = await fetch(`${API_URL}/api/boat-types`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

async function getUnsolvedQuestions(): Promise<Question[]> {
  const res = await fetch(`${API_URL}/api/questions?limit=10`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const all: Question[] = data.questions ?? [];
  return all.filter((q) => !q.answers.some((a) => a.isAccepted)).slice(0, 4);
}

async function getTeams(): Promise<TeamSummary[]> {
  const res = await fetch(`${API_URL}/api/teams`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.teams ?? [];
}

async function getQAStats(): Promise<{ total: number; solved: number }> {
  const res = await fetch(`${API_URL}/api/questions?limit=100`, { cache: "no-store" });
  if (!res.ok) return { total: 0, solved: 0 };
  const data = await res.json();
  const all: Question[] = data.questions ?? [];
  const solved = all.filter((q) => q.answers.some((a) => a.isAccepted)).length;
  return { total: data.total ?? 0, solved };
}

const YACHT_ORDER = ["op", "420", "470", "snipe", "49er", "cruiser"];
const YACHT_EXCLUDE = new Set(["ilca"]);

export default async function HomePage() {
  const [boatTypes, unsolvedQuestions, teams, qaStats] = await Promise.all([
    getBoatTypes(),
    getUnsolvedQuestions(),
    getTeams(),
    getQAStats(),
  ]);

  const rankedTeams = [...teams]
    .sort((a, b) => (b._count.articles + b._count.questions) - (a._count.articles + a._count.questions))
    .slice(0, 5);

  return (
    <div className="container">
      <div className="layout-two-col">
        {/* ===== メインカラム ===== */}
        <div>
          <div className="bento-grid">

            {/* Row 1: Class Focus (2col × 2u = 400px) */}
            <ClassFocusTile />

            {/* Row 2: Pick Up Reference (1col × 1u) */}
            <PickUpReference />

            {/* Row 2: Unsolved Q&A (1col × 1u) */}
            <div className="bento-tile bento-tile-h1" style={{ borderLeft: "3px solid var(--sage)" }}>
              <div className="bento-tile-label">
                <span className="bento-tile-label-dot" style={{ background: "var(--sage)" }} />
                UNSOLVED Q&amp;A
              </div>
              {unsolvedQuestions.length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "var(--fg-mute)" }}>未解決の質問はありません</p>
              ) : (
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0", flex: 1, overflow: "hidden" }}>
                  {unsolvedQuestions.map((q, i) => (
                    <li key={q.id}>
                      <Link
                        href={`/questions/${q.id}`}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.6rem",
                          padding: "0.5rem 0",
                          borderBottom: i < unsolvedQuestions.length - 1 ? "1px solid var(--border)" : "none",
                          textDecoration: "none",
                        }}
                      >
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--sage)", fontWeight: 700, flexShrink: 0, marginTop: "0.15rem" }}>?</span>
                        <span style={{ fontSize: "0.82rem", color: "var(--fg-2)", fontWeight: 500, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {q.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/questions" style={{ marginTop: "auto", paddingTop: "0.5rem", fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--fg-dim)", flexShrink: 0 }}>
                All Q&amp;A →
              </Link>
            </div>

            {/* Row 3: Intelligence Feed (2col — 内容に合わせた高さ、min 1u) */}
            <div className="bento-tile bento-tile-span2" style={{ padding: 0, minHeight: "var(--bento-unit)" }}>
              <IntelligenceFeed />
            </div>

            {/* Row 4: Team Highlights (1col × 1u) */}
            <div className="bento-tile bento-tile-h1" style={{ borderLeft: "3px solid var(--dijon)" }}>
              <div className="bento-tile-label">
                <span className="bento-tile-label-dot" style={{ background: "var(--dijon)" }} />
                TEAM HIGHLIGHTS
              </div>
              {rankedTeams.slice(0, 3).length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "var(--fg-mute)" }}>チーム情報がありません</p>
              ) : (
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0", flex: 1, overflow: "hidden" }}>
                  {rankedTeams.slice(0, 3).map((t, i) => (
                    <li key={t.id}>
                      <Link
                        href={`/teams/${t.slug}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.5rem 0",
                          borderBottom: i < 2 ? "1px solid var(--border)" : "none",
                          textDecoration: "none",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ fontSize: "0.82rem", color: "var(--fg-2)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {t.university ?? t.name}
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--fg-dim)", flexShrink: 0 }}>
                          {t._count.articles + t._count.questions}pts
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/teams" style={{ marginTop: "auto", paddingTop: "0.5rem", fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--fg-dim)", flexShrink: 0 }}>
                All Teams →
              </Link>
            </div>

            {/* Row 4: Quick Links (1col × 1u) */}
            <div className="bento-tile bento-tile-h1">
              <div className="bento-tile-label">
                <span className="bento-tile-label-dot" />
                NAVIGATE
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", flex: 1 }}>
                {[
                  { href: "/reference", icon: "◇", label: "Reference", color: "var(--terra)" },
                  { href: "/questions", icon: "?", label: "Q&A", color: "var(--sage)" },
                  { href: "/learn", icon: "▶", label: "Learn", color: "var(--dijon)" },
                  { href: "/sailors", icon: "◉", label: "Sailors", color: "var(--fg-mute)" },
                ].map(({ href, icon, label, color }) => (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.4rem",
                      padding: "0.75rem",
                      background: "var(--paper-2)",
                      borderRadius: "var(--radius-sm)",
                      textDecoration: "none",
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ fontSize: "1rem", color }}>{icon}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", fontWeight: 600, color: "var(--fg-mute)" }}>{label}</span>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ===== 右サイドバー (統計特化) ===== */}
        <aside className="sidebar">
          {/* Yachts */}
          <div className="module">
            <h3 className="sidebar-title">Yachts</h3>
            <ul className="sidebar-list">
              {[...boatTypes]
                .filter((bt) => !YACHT_EXCLUDE.has(bt.slug))
                .sort((a, b) => {
                  const ai = YACHT_ORDER.indexOf(a.slug);
                  const bi = YACHT_ORDER.indexOf(b.slug);
                  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                })
                .map((bt) => (
                  <li key={bt.slug}>
                    <Link href={`/boat/${bt.slug}`} className="yacht-row">
                      <ClassFlag slug={bt.slug} />
                      <span>{bt.name}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          {/* Team Power Ranking */}
          <div className="stat-widget">
            <div className="stat-widget-title">Team Power Ranking</div>
            {rankedTeams.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "var(--fg-mute)" }}>データなし</p>
            ) : rankedTeams.map((t, i) => (
              <Link key={t.id} href={`/teams/${t.slug}`} style={{ textDecoration: "none" }}>
                <div className="rank-item">
                  <span className="rank-num">{i + 1}</span>
                  <span className="rank-name">{t.university ?? t.name}</span>
                  <span className="rank-pts">{t._count.articles + t._count.questions}pts</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Q&A Stats */}
          <div className="stat-widget">
            <div className="stat-widget-title">Q&amp;A Status</div>
            <div className="qa-stat-row">
              <span className="qa-stat-label">Total</span>
              <span className="qa-stat-value">{qaStats.total}</span>
            </div>
            <div className="qa-stat-row">
              <span className="qa-stat-label">Solved</span>
              <span className="qa-stat-value solved">{qaStats.solved}</span>
            </div>
            <div className="qa-stat-row">
              <span className="qa-stat-label">Unsolved</span>
              <span className="qa-stat-value unsolved">{qaStats.total - qaStats.solved}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
