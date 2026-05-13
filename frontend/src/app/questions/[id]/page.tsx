import Link from "next/link";
import { notFound } from "next/navigation";
import { mockQuestions, mockAnswers, timeAgo } from "@/lib/mock";

export default function QuestionDetailPage({ params }: { params: { id: string } }) {
  const question = mockQuestions.find((q) => q.id === Number(params.id));
  if (!question) notFound();

  const answers = mockAnswers.filter((a) => a.questionId === question.id);
  const sorted = [...answers].sort((a, b) => {
    if (a.isAccepted && !b.isAccepted) return -1;
    if (!a.isAccepted && b.isAccepted) return 1;
    return b.voteCount - a.voteCount;
  });

  return (
    <div className="container">
      <div className="page-header">
        <Link href="/questions" className="page-header-back">Questions</Link>
        <h1 className="page-header-title">{question.title}</h1>
        <p className="page-header-sub" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", letterSpacing: "0.05em" }}>
          <span style={{ color: "var(--terra)" }}>● {question.boatType}</span> · @{question.author.username} · {timeAgo(question.createdAt)} · {question.views} views
          {question.hasAcceptedAnswer && <span className="accepted-pill" style={{ marginLeft: "0.6rem" }}>Solved</span>}
        </p>
      </div>

      <div className="layout-two-col">
        <div>
          {/* Question body */}
          <article className="article-detail" style={{ padding: "2rem 2.25rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: "1.25rem" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
                <button className="btn btn-ghost" style={{ padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}>▲</button>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700, color: "var(--fg)" }}>{question.voteCount}</div>
                <button className="btn btn-ghost" style={{ padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}>▼</button>
              </div>
              <div>
                <div className="markdown-body" style={{ fontSize: "0.95rem" }}>
                  <p>{question.body}</p>
                </div>
                <div className="article-card-tags" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
                  {question.tags.map((t) => (
                    <span key={t} className="tag">{t}</span>
                  ))}
                </div>
                <div className="article-card-footer" style={{ marginTop: "1.5rem", paddingTop: "1rem" }}>
                  <Link href={`/users/${question.author.username}`} className="author-link">
                    <span className="author-avatar-sm">{question.author.username[0].toUpperCase()}</span>
                    @{question.author.username}
                  </Link>
                  <span className="article-date">asked {timeAgo(question.createdAt)}</span>
                </div>
              </div>
            </div>
          </article>

          {/* Answers header */}
          <div className="section-head">
            <h2 className="section-head-title">{answers.length} Answers</h2>
            <span className="section-head-action" style={{ color: "var(--fg-mute)" }}>Sorted by Votes</span>
          </div>

          {/* Answers */}
          <div className="stagger">
            {sorted.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">○</div>
                <p className="empty-state-text">NO ANSWERS YET // 最初の回答者になろう</p>
              </div>
            ) : (
              sorted.map((a) => (
                <article
                  key={a.id}
                  className="article-detail"
                  style={{
                    padding: "1.75rem 2rem",
                    marginBottom: "1rem",
                    borderLeft: a.isAccepted ? "3px solid var(--sage)" : "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: "1.25rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
                      <button className="btn btn-ghost" style={{ padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}>▲</button>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, color: a.isAccepted ? "var(--sage)" : "var(--fg)" }}>
                        {a.voteCount}
                      </div>
                      <button className="btn btn-ghost" style={{ padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}>▼</button>
                      {a.isAccepted && (
                        <div title="Accepted" style={{ marginTop: "0.4rem", color: "var(--sage)", fontSize: "1.4rem" }}>✓</div>
                      )}
                    </div>
                    <div>
                      {a.isAccepted && <span className="accepted-pill" style={{ marginBottom: "0.85rem", display: "inline-flex" }}>Accepted Answer</span>}
                      <div className="markdown-body" style={{ fontSize: "0.95rem", marginTop: a.isAccepted ? "0.5rem" : 0 }}>
                        <p>{a.body}</p>
                      </div>
                      <div className="article-card-footer" style={{ marginTop: "1.5rem", paddingTop: "1rem" }}>
                        <Link href={`/users/${a.author.username}`} className="author-link">
                          <span className="author-avatar-sm">{a.author.username[0].toUpperCase()}</span>
                          @{a.author.username}
                          <span style={{ color: "var(--fg-dim)", marginLeft: "0.4rem" }}>· {a.author.specialty}</span>
                        </Link>
                        <span className="article-date">answered {timeAgo(a.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          {/* Answer composer */}
          <div className="composer" style={{ marginTop: "2rem" }}>
            <h3 className="sidebar-title" style={{ marginBottom: "1rem" }}>Your Answer</h3>
            <textarea placeholder="Markdown supported. 体験ベースで具体的に書くと役立ちます。" rows={6} />
            <div className="composer-footer">
              <span className="composer-counter">Markdown // ↵ to break</span>
              <button className="btn btn-primary">Post Answer</button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="module">
            <h3 className="sidebar-title">Asked By</h3>
            <div style={{ display: "flex", gap: "0.85rem", alignItems: "center" }}>
              <div className="sailor-avatar" style={{ color: question.author.avatarColor }}>
                {question.author.displayName[0]}
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--fg)" }}>
                  {question.author.displayName}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--fg-mute)" }}>
                  @{question.author.username} · {question.author.experienceYears}y
                </div>
              </div>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--fg-2)", marginTop: "1rem", lineHeight: 1.6 }}>
              {question.author.bio}
            </p>
          </div>

          <div className="module">
            <h3 className="sidebar-title">Related</h3>
            <ul className="sidebar-list">
              {mockQuestions.filter((q) => q.id !== question.id).slice(0, 3).map((q) => (
                <li key={q.id}>
                  <Link href={`/questions/${q.id}`}>
                    <span style={{ fontSize: "0.85rem", lineHeight: 1.4, display: "block" }}>{q.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
