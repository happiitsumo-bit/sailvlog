import Link from "next/link";
import { mockCourses } from "@/lib/mock";

export default function LearnPage() {
  return (
    <div className="container">
      <div className="page-header">
        <Link href="/" className="page-header-back">Home</Link>
        <h1 className="page-header-title">
          Learn <span style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: "1rem", marginLeft: "0.5rem" }}>// {mockCourses.length} courses</span>
        </h1>
        <p className="page-header-sub">体系化された学習コースで、基礎から戦術まで段階的に学べる。</p>
      </div>

      <div className="filter-bar">
        <button className="filter-chip active">All</button>
        <button className="filter-chip">Beginner</button>
        <button className="filter-chip">Intermediate</button>
        <button className="filter-chip">Advanced</button>
        <button className="filter-chip">470</button>
        <button className="filter-chip">ILCA</button>
        <button className="filter-chip">Cruiser</button>
      </div>

      <div className="course-grid stagger">
        {mockCourses.map((c) => (
          <Link
            key={c.id}
            href={`/learn/${c.slug}`}
            className="course-card"
            style={{ ["--accent" as string]: c.accentColor }}
          >
            <div className="course-level">{c.level} · {c.boatType}</div>
            <h2 className="course-title">{c.title}</h2>
            <p className="course-subtitle">{c.subtitle}</p>
            <div className="course-stats">
              <div>
                <span className="course-stat-num">{c.lessonCount}</span>
                <span className="course-stat-label">Lessons</span>
              </div>
              <div>
                <span className="course-stat-num">{c.estimatedHours}h</span>
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
    </div>
  );
}
