import Link from "next/link";
import { notFound } from "next/navigation";
import { Course } from "@/types";

const API_URL = process.env.API_URL ?? "http://backend:8000";

export default async function CourseDetailPage({ params }: { params: { slug: string } }) {
  const res = await fetch(`${API_URL}/api/courses/${params.slug}`, { cache: "no-store" });
  if (!res.ok) notFound();

  const course: Course = await res.json();

  // 全コース取得（サイドバー用）
  const allRes = await fetch(`${API_URL}/api/courses`, { cache: "no-store" });
  const allCourses: Course[] = allRes.ok ? await allRes.json() : [];
  const otherCourses = allCourses.filter((c) => c.id !== course.id);

  return (
    <div className="container">
      <div className="page-header">
        <Link href="/learn" className="page-header-back">Courses</Link>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.85rem", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: course.accentColor, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            ── {course.level} · {course.boatType?.name ?? "ALL"}
          </span>
        </div>
        <h1 className="page-header-title" style={{ marginTop: "0.5rem" }}>{course.title}</h1>
        <p className="page-header-sub" style={{ fontSize: "1.05rem" }}>{course.subtitle}</p>
      </div>

      <div className="layout-two-col">
        <div>
          <div className="hero-stats" style={{ marginTop: 0, marginBottom: "2rem", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
            <div className="hero-stat">
              <div className="hero-stat-label">Lessons</div>
              <div className="hero-stat-value" style={{ color: course.accentColor }}>{course.courseArticles.length}</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-label">Total Time</div>
              <div className="hero-stat-value">{course.estimatedHours}h</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-label">Enrolled</div>
              <div className="hero-stat-value">{course.enrolledCount}</div>
            </div>
          </div>

          <p style={{ fontSize: "1rem", color: "var(--fg-2)", lineHeight: 1.8, marginBottom: "2.5rem" }}>
            {course.description}
          </p>

          <div className="section-head">
            <h2 className="section-head-title">Curriculum</h2>
            <span className="section-head-action" style={{ color: "var(--fg-mute)" }}>{course.courseArticles.length} lessons</span>
          </div>

          <ul className="lesson-list stagger">
            {course.courseArticles.map((l, idx) => (
              <li key={l.id} className="lesson-item">
                <div className="lesson-num">{String(idx + 1).padStart(2, "0")}</div>
                <div className="lesson-title">{l.title}</div>
                <div className="lesson-duration">{l.minutes}min</div>
              </li>
            ))}
          </ul>
        </div>

        <aside className="sidebar">
          <div className="module" style={{ borderColor: course.accentColor, borderTopWidth: 3 }}>
            <h3 className="sidebar-title">Enroll</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--fg-mute)", marginBottom: "1rem", lineHeight: 1.6 }}>
              無料。進捗は自動保存。あなたのペースで進められます。
            </p>
            <button className="btn btn-primary" style={{ width: "100%", marginBottom: "0.5rem" }}>▲ Start Course</button>
            <button className="btn btn-ghost" style={{ width: "100%" }}>＋ Save for Later</button>
          </div>

          {otherCourses.length > 0 && (
            <div className="module">
              <h3 className="sidebar-title">Other Courses</h3>
              <ul className="sidebar-list">
                {otherCourses.map((c) => (
                  <li key={c.id}>
                    <Link href={`/learn/${c.slug}`}>
                      <span style={{ fontSize: "0.85rem" }}>{c.title}</span>
                      <span className="count">{c.courseArticles.length}L</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
