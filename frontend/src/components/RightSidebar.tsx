import Link from "next/link";
import ClassFlag from "@/components/ClassFlag";
import { BoatType, Question, TeamSummary } from "@/types";

const API_URL = process.env.API_URL ?? "http://backend:8000";

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

async function getBoatTypes(): Promise<BoatType[]> {
  return safeFetch<BoatType[]>("/api/boat-types", []);
}

async function getTeams(): Promise<TeamSummary[]> {
  const data = await safeFetch<{ teams?: TeamSummary[] }>("/api/teams", {});
  return data.teams ?? [];
}

async function getQAStats(): Promise<{ total: number; solved: number }> {
  const data = await safeFetch<{ total?: number; questions?: Question[] }>(
    "/api/questions?limit=100",
    {}
  );
  const all = data.questions ?? [];
  const solved = all.filter((q) => q.answers.some((a) => a.isAccepted)).length;
  return { total: data.total ?? 0, solved };
}

const YACHT_ORDER = ["op", "420", "470", "snipe", "49er", "cruiser"];
const YACHT_EXCLUDE = new Set(["ilca"]);

export default async function RightSidebar() {
  const [boatTypes, teams, qaStats] = await Promise.all([
    getBoatTypes(),
    getTeams(),
    getQAStats(),
  ]);

  const rankedTeams = [...teams]
    .sort((a, b) => (b._count.articles + b._count.questions) - (a._count.articles + a._count.questions))
    .slice(0, 5);

  return (
    <aside className="app-right-sidebar">

      {/* Yachts */}
      <div className="stat-widget">
        <div className="stat-widget-title">Yachts</div>
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
                  <span style={{ fontSize: "0.85rem" }}>{bt.name}</span>
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
  );
}
