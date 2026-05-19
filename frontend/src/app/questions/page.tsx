import Link from "next/link";
import ClassFlag from "@/components/ClassFlag";
import { Question, BoatType, Tag } from "@/types";

const API_URL = process.env.API_URL ?? "http://backend:8000";

type SearchParams = { [key: string]: string | string[] | undefined };

function getString(val: string | string[] | undefined): string | undefined {
  return Array.isArray(val) ? val[0] : val;
}

async function getQuestions(searchParams: SearchParams) {
  const params = new URLSearchParams();
  const boatType = getString(searchParams.boatType);
  const filter = getString(searchParams.filter);
  if (boatType) params.set("boatType", boatType);
  if (filter) params.set("filter", filter);

  const res = await fetch(`${API_URL}/api/questions?${params}`, { cache: "no-store" });
  if (!res.ok) return { questions: [], total: 0 };
  return res.json() as Promise<{ questions: Question[]; total: number }>;
}

async function getBoatTypes(): Promise<BoatType[]> {
  const res = await fetch(`${API_URL}/api/boat-types`, { cache: "force-cache" });
  if (!res.ok) return [];
  return res.json();
}

async function getHotTags(): Promise<Tag[]> {
  const res = await fetch(`${API_URL}/api/tags`, { cache: "force-cache" });
  if (!res.ok) return [];
  return res.json();
}

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

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [{ questions, total }, boatTypes, tags] = await Promise.all([
    getQuestions(searchParams),
    getBoatTypes(),
    getHotTags(),
  ]);

  const solvedCount = questions.filter((q) => q.answers.some((a) => a.isAccepted)).length;
  const currentFilter = getString(searchParams.filter) ?? "latest";

  return (
    <div className="container">
      <div className="page-header">
        <Link href="/" className="page-header-back">Home</Link>
        <h1 className="page-header-title">
          Q&amp;A <span style={{ color: "var(--fg-mute)", fontFamily: "var(--font-mono)", fontSize: "1rem", marginLeft: "0.5rem" }}>{total} threads · {solvedCount} solved</span>
        </h1>
        <p className="page-header-sub">セーラー同士で疑問を解決。質問を投げれば、ベテランが応える。</p>
      </div>

      <div className="layout-two-col">
        <div>
          <div className="filter-bar">
            <Link href="/questions" className={`filter-chip ${!searchParams.filter ? "active" : ""}`}>All</Link>
            <Link href="/questions?filter=unanswered" className={`filter-chip ${currentFilter === "unanswered" ? "active" : ""}`}>Unanswered</Link>
            <Link href="/questions?filter=solved" className={`filter-chip ${currentFilter === "solved" ? "active" : ""}`}>Solved</Link>
            <Link href="/questions?filter=top" className={`filter-chip ${currentFilter === "top" ? "active" : ""}`}>Top Voted</Link>
            <div style={{ marginLeft: "auto" }}>
              <Link href="/questions/new" className="btn btn-primary">+ Ask</Link>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">○</div>
              <p className="empty-state-text">NO QUESTIONS YET // 最初の質問者になろう</p>
            </div>
          ) : (
            <div className="stagger">
              {questions.map((q) => {
                const hasAccepted = q.answers.some((a) => a.isAccepted);
                return (
                  <Link key={q.id} href={`/questions/${q.id}`} className={`question-card ${hasAccepted ? "solved" : ""}`} style={{ display: "grid" }}>
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
                      <div className="q-metric">
                        <div className="q-metric-value" style={{ color: "var(--fg-mute)", fontSize: "0.95rem" }}>{q.viewCount}</div>
                        <div className="q-metric-label">Views</div>
                      </div>
                    </div>
                    <div className="question-main">
                      <h3 className="question-title">{q.title}</h3>
                      <p className="question-body">{q.body.slice(0, 120)}{q.body.length > 120 ? "…" : ""}</p>
                      <div className="article-card-tags" style={{ marginBottom: "0.6rem" }}>
                        {q.tags.map(({ tag }) => (
                          <span key={tag.id} className="tag">{tag.name}</span>
                        ))}
                      </div>
                      <div className="question-meta">
                        {q.boatType && <span style={{ color: "var(--terra)" }}>● {q.boatType.name}</span>}
                        <span>@{q.author.username}</span>
                        <span>{timeAgo(q.createdAt)}</span>
                        {hasAccepted && <span className="accepted-pill">Solved</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
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
            <h3 className="sidebar-title">質問のコツ</h3>
            <ul style={{ fontSize: "0.82rem", color: "var(--fg-mute)", lineHeight: 1.8, paddingLeft: "1.2rem" }}>
              <li>艇種を明記する</li>
              <li>風速・コンディションを書く</li>
              <li>試したことをリストアップ</li>
            </ul>
          </div>

          {boatTypes.length > 0 && (
            <div className="module">
              <h3 className="sidebar-title">By Yacht</h3>
              <ul className="sidebar-list">
                {boatTypes.map((bt) => (
                  <li key={bt.slug}>
                    <Link href={`/questions?boatType=${bt.slug}`} className="yacht-row">
                      <ClassFlag slug={bt.slug} />
                      <span>{bt.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tags.length > 0 && (
            <div className="module">
              <h3 className="sidebar-title">Popular Tags</h3>
              <div className="tag-cloud">
                {tags.slice(0, 8).map((t) => (
                  <Link key={t.slug} href={`/tag/${t.slug}`} className="tag-pill">
                    {t.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
