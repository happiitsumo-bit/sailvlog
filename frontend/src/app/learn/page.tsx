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

export default async function LearnPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const level = Array.isArray(searchParams.level) ? searchParams.level[0] : searchParams.level;
  const courses = await getCourses(level);

  const levels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

  return (
    <div className="container">
      <div className="page-header">
        <Link href="/" className="page-header-back">Home</Link>
        <h1 className="page-header-title">
          Learn <span style={{ color: "var(--sage)", fontFamily: "var(--font-mono)", fontSize: "1rem", marginLeft: "0.5rem" }}>// {courses.length} courses</span>
        </h1>
        <p className="page-header-sub">体系化された学習コースで、基礎から戦術まで段階的に学べる。</p>
      </div>

      <div className="filter-bar">
        <Link href="/learn" className={`filter-chip ${!level ? "active" : ""}`}>All</Link>
        {levels.map((l) => (
          <Link key={l} href={`/learn?level=${l}`} className={`filter-chip ${level === l ? "active" : ""}`}>
            {l.charAt(0) + l.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">○</div>
          <p className="empty-state-text">NO COURSES // まもなく公開予定</p>
        </div>
      ) : (
        <div className="course-grid stagger">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/learn/${c.slug}`}
              className="course-card"
              style={{ ["--accent" as string]: c.accentColor }}
            >
              {(() => {
                const difficultyLevel = c.level === "BEGINNER" ? 1 : c.level === "INTERMEDIATE" ? 2 : 3;
                return (
                  <div className="course-difficulty-bar">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className={`course-difficulty-pip ${n <= difficultyLevel ? "filled" : ""}`} />
                    ))}
                  </div>
                );
              })()}
              <div className="course-level">{c.level} · {c.boatType?.name ?? "ALL"}</div>
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
          ))}
        </div>
      )}
    </div>
  );
}
