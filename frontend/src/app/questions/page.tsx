import Link from "next/link";
import ClassFlag from "@/components/ClassFlag";
import { mockQuestions, mockHotTags, mockBoatTypes, timeAgo } from "@/lib/mock";

export default function QuestionsPage() {
  const totalQuestions = mockQuestions.length;
  const solvedCount = mockQuestions.filter((q) => q.hasAcceptedAnswer).length;

  return (
    <div className="container">
      <div className="page-header">
        <Link href="/" className="page-header-back">Home</Link>
        <h1 className="page-header-title">
          Q&amp;A <span style={{ color: "var(--fg-mute)", fontFamily: "var(--font-mono)", fontSize: "1rem", marginLeft: "0.5rem" }}>{totalQuestions} threads · {solvedCount} solved</span>
        </h1>
        <p className="page-header-sub">セーラー同士で疑問を解決。質問を投げれば、ベテランが応える。</p>
      </div>

      <div className="layout-two-col">
        <div>
          <div className="filter-bar">
            <button className="filter-chip active">All</button>
            <button className="filter-chip">Unanswered</button>
            <button className="filter-chip">Solved</button>
            <button className="filter-chip">Latest</button>
            <button className="filter-chip">Top Voted</button>
            <div style={{ marginLeft: "auto" }}>
              <Link href="/questions/new" className="btn btn-primary">+ Ask</Link>
            </div>
          </div>

          <div className="stagger">
            {mockQuestions.map((q) => (
              <Link key={q.id} href={`/questions/${q.id}`} className="question-card" style={{ display: "grid" }}>
                <div className="question-metrics">
                  <div className="q-metric">
                    <div className={`q-metric-value ${q.hasAcceptedAnswer ? "accepted" : q.answerCount > 0 ? "has-answers" : ""}`}>
                      {q.answerCount}
                    </div>
                    <div className="q-metric-label">Ans</div>
                  </div>
                  <div className="q-metric">
                    <div className="q-metric-value">{q.voteCount}</div>
                    <div className="q-metric-label">Votes</div>
                  </div>
                  <div className="q-metric">
                    <div className="q-metric-value" style={{ color: "var(--fg-mute)", fontSize: "0.95rem" }}>{q.views}</div>
                    <div className="q-metric-label">Views</div>
                  </div>
                </div>
                <div className="question-main">
                  <h3 className="question-title">{q.title}</h3>
                  <p className="question-body">{q.body}</p>
                  <div className="article-card-tags" style={{ marginBottom: "0.6rem" }}>
                    {q.tags.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                  <div className="question-meta">
                    <span style={{ color: "var(--terra)" }}>● {q.boatType}</span>
                    <span>@{q.author.username}</span>
                    <span>{timeAgo(q.createdAt)}</span>
                    {q.hasAcceptedAnswer && <span className="accepted-pill">Solved</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <aside className="sidebar">
          <div className="module">
            <h3 className="sidebar-title">Ask a Question</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--fg-mute)", marginBottom: "1rem", lineHeight: 1.6 }}>
              艇種・タグを指定して質問するほど、回答が集まりやすくなります。
            </p>
            <Link href="/questions/new" className="btn btn-primary" style={{ width: "100%" }}>+ New Question</Link>
          </div>

          <div className="module">
            <h3 className="sidebar-title">By Yacht</h3>
            <ul className="sidebar-list">
              {mockBoatTypes.map((bt) => (
                <li key={bt.slug}>
                  <Link href={`/questions?boat=${bt.slug}`} className="yacht-row">
                    <ClassFlag slug={bt.slug} />
                    <span>{bt.name}</span>
                    <span className="count">{bt.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="module">
            <h3 className="sidebar-title">Popular Tags</h3>
            <div className="tag-cloud">
              {mockHotTags.map((t) => (
                <Link key={t.name} href={`/tag/${t.name}`} className="tag-pill">
                  {t.name}
                  <span className="tcount">{t.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
