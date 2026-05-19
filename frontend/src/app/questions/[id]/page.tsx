import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionDetail } from "@/types";
import AnswerComposer from "./AnswerComposer";
import VoteButtons from "./VoteButtons";
import AcceptButton from "./AcceptButton";
import AcceptGate from "./AcceptGate";

const API_URL = process.env.API_URL ?? "http://backend:8000";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

export default async function QuestionDetailPage({ params }: { params: { id: string } }) {
  const res = await fetch(`${API_URL}/api/questions/${params.id}`, { cache: "no-store" });
  if (!res.ok) notFound();

  const question: QuestionDetail = await res.json();
  const hasAccepted = question.answers.some((a) => a.isAccepted);

  const sorted = [...question.answers].sort((a, b) => {
    if (a.isAccepted && !b.isAccepted) return -1;
    if (!a.isAccepted && b.isAccepted) return 1;
    return b._count.votes - a._count.votes;
  });

  return (
    <div className="container">
      <div className="page-header">
        <Link href="/questions" className="page-header-back">Questions</Link>
        <h1 className="page-header-title">{question.title}</h1>
        <p className="page-header-sub" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", letterSpacing: "0.05em" }}>
          {question.boatType && <span style={{ color: "var(--terra)" }}>● {question.boatType.name} · </span>}
          @{question.author.username} · {timeAgo(question.createdAt)} · {question.viewCount} views
          {hasAccepted && <span className="accepted-pill" style={{ marginLeft: "0.6rem" }}>Solved</span>}
        </p>
      </div>

      <div className="layout-two-col">
        <div>
          {/* Question body */}
          <article className="article-detail" style={{ padding: "2rem 2.25rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: "1.25rem" }}>
              <VoteButtons targetId={question.id} initialVotes={question._count.votes} type="question" />
              <div>
                <div className="markdown-body" style={{ fontSize: "0.95rem" }}>
                  <p style={{ whiteSpace: "pre-wrap" }}>{question.body}</p>
                </div>
                <div className="article-card-tags" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
                  {question.tags.map(({ tag }) => (
                    <span key={tag.id} className="tag">{tag.name}</span>
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
            <h2 className="section-head-title">{question.answers.length} Answers</h2>
            <span className="section-head-action" style={{ color: "var(--fg-mute)" }}>Sorted by Votes</span>
          </div>

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
                      <VoteButtons
                        type="answer"
                        targetId={a.id}
                        questionId={question.id}
                        initialVotes={a._count.votes}
                      />
                      <AcceptGate
                        questionAuthorId={question.author.id}
                        questionId={question.id}
                        answerId={a.id}
                        isAccepted={a.isAccepted}
                      />
                    </div>
                    <div>
                      {a.isAccepted && (
                        <span className="accepted-pill" style={{ marginBottom: "0.85rem", display: "inline-flex" }}>Accepted Answer</span>
                      )}
                      <div className="markdown-body" style={{ fontSize: "0.95rem", marginTop: a.isAccepted ? "0.5rem" : 0 }}>
                        <p style={{ whiteSpace: "pre-wrap" }}>{a.body}</p>
                      </div>
                      <div className="article-card-footer" style={{ marginTop: "1.5rem", paddingTop: "1rem" }}>
                        <Link href={`/users/${a.author.username}`} className="author-link">
                          <span className="author-avatar-sm">{a.author.username[0].toUpperCase()}</span>
                          @{a.author.username}
                          {a.author.specialty && (
                            <span style={{ color: "var(--fg-dim)", marginLeft: "0.4rem" }}>· {a.author.specialty}</span>
                          )}
                        </Link>
                        <span className="article-date">answered {timeAgo(a.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <AnswerComposer questionId={question.id} />
        </div>

        <aside className="sidebar">
          <div className="module">
            <h3 className="sidebar-title">Asked By</h3>
            <div style={{ display: "flex", gap: "0.85rem", alignItems: "center" }}>
              <div className="sailor-avatar">
                {question.author.username[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--fg)" }}>
                  @{question.author.username}
                </div>
                {question.author.experienceYears && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--fg-mute)" }}>
                    経験 {question.author.experienceYears}年
                  </div>
                )}
              </div>
            </div>
            {question.author.bio && (
              <p style={{ fontSize: "0.85rem", color: "var(--fg-2)", marginTop: "1rem", lineHeight: 1.6 }}>
                {question.author.bio}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
