import Link from "next/link";
import { Course } from "@/types";

const API_URL = process.env.API_URL ?? "http://backend:8000";

async function getCourses(level?: string): Promise<Course[]> {
  const params = level ? `?level=${level}` : "";
  const res = await fetch(`${API_URL}/api/courses${params}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

type SearchParams = { [key: string]: string | string[] | undefined };

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
type Level = (typeof LEVELS)[number];

const levelConfig: Record<Level, { label: string; color: string; pip: number }> = {
  BEGINNER: { label: "Beginner", color: "var(--sage)", pip: 1 },
  INTERMEDIATE: { label: "Intermediate", color: "var(--dijon)", pip: 2 },
  ADVANCED: { label: "Advanced", color: "var(--terra)", pip: 3 },
};

export default async function LearnPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const level = Array.isArray(searchParams.level) ? searchParams.level[0] : searchParams.level;
  const courses = await getCourses(level);

  const grouped: Record<Level, Course[]> = {
    BEGINNER: courses.filter((c) => c.level === "BEGINNER"),
    INTERMEDIATE: courses.filter((c) => c.level === "INTERMEDIATE"),
    ADVANCED: courses.filter((c) => c.level === "ADVANCED"),
  };

  return (
    <div className="container">
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.4rem",
            fontWeight: 700,
            color: "var(--fg)",
            marginBottom: "0.25rem",
          }}
        >
          Learn
        </h1>
        <p style={{ color: "var(--fg-mute)", fontSize: "0.85rem" }}>
          Structured courses from beginner to advanced.
        </p>
      </div>

      <div className="filter-bar">
        <Link href="/learn" className={`filter-chip ${!level ? "active" : ""}`}>All</Link>
        {LEVELS.map((l) => (
          <Link key={l} href={`/learn?level=${l}`} className={`filter-chip ${level === l ? "active" : ""}`}>
            {levelConfig[l].label}
          </Link>
        ))}
      </div>

      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">○</div>
          <p className="empty-state-text">NO COURSES // まもなく公開予定</p>
        </div>
      ) : (
        LEVELS.map((lv) =>
          grouped[lv].length > 0 ? (
            <div key={lv} style={{ marginBottom: "2.5rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ display: "flex", gap: 3 }}>
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      style={{
                        width: 18,
                        height: 4,
                        borderRadius: 2,
                        background:
                          n <= levelConfig[lv].pip
                            ? levelConfig[lv].color
                            : "var(--border-strong)",
                      }}
                    />
                  ))}
                </div>
                <h2
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: levelConfig[lv].color,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {levelConfig[lv].label}
                </h2>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.72rem",
                    color: "var(--fg-dim)",
                  }}
                >
                  {grouped[lv].length} {grouped[lv].length === 1 ? "course" : "courses"}
                </span>
              </div>
              <div className="course-grid stagger">
                {grouped[lv].map((c) => {
                  const difficultyLevel = c.level === "BEGINNER" ? 1 : c.level === "INTERMEDIATE" ? 2 : 3;
                  return (
                    <Link
                      key={c.id}
                      href={`/learn/${c.slug}`}
                      className="course-card"
                      style={{ ["--accent" as string]: c.accentColor }}
                    >
                      <div className="course-difficulty-bar">
                        {[1, 2, 3].map((n) => (
                          <div key={n} className={`course-difficulty-pip ${n <= difficultyLevel ? "filled" : ""}`} />
                        ))}
                      </div>
                      <div className="course-level">
                        {c.level} · {c.boatType?.name ?? "ALL"}
                      </div>
                      <h2 className="course-title">{c.title}</h2>
                      <p className="course-subtitle">{c.subtitle}</p>
                      <div className="course-stats">
                        <div>
                          <span className="course-stat-num">{c.courseArticles.length}</span>
                          <span className="course-stat-label">Lessons</span>
                        </div>
                        <div>
                          <span className="course-stat-num">{c.estimatedHours != null ? `${c.estimatedHours}h` : "—"}</span>
                          <span className="course-stat-label">Total</span>
                        </div>
                        <div>
                          <span className="course-stat-num">{c.enrolledCount}</span>
                          <span className="course-stat-label">Enrolled</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null
        )
      )}
    </div>
  );
}
