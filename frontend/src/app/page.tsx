import ArticleCard from "@/components/ArticleCard";
import ClassFlag from "@/components/ClassFlag";
import Link from "next/link";
import { ArticleSummary, BoatType, Question, Post } from "@/types";
import { getAvatarColor, timeAgo } from "@/lib/utils";

const YACHT_ORDER = ["op", "420", "470", "snipe", "49er", "cruiser"];
const YACHT_EXCLUDE = new Set(["ilca"]);

const API_URL = process.env.API_URL ?? "http://backend:8000";

async function getArticles(): Promise<{ articles: ArticleSummary[]; total: number }> {
  const res = await fetch(`${API_URL}/api/articles?limit=5`, { cache: "no-store" });
  if (!res.ok) return { articles: [], total: 0 };
  const data = await res.json();
  return { articles: data.articles ?? [], total: data.total ?? 0 };
}

async function getStats(): Promise<{ questions: number; posts: number }> {
  const [qRes, pRes] = await Promise.all([
    fetch(`${API_URL}/api/questions?limit=1`, { cache: "no-store" }),
    fetch(`${API_URL}/api/posts?limit=1`, { cache: "no-store" }),
  ]);
  const qData = qRes.ok ? await qRes.json() : { total: 0 };
  const pData = pRes.ok ? await pRes.json() : { total: 0 };
  return { questions: qData.total ?? 0, posts: pData.total ?? 0 };
}

async function getBoatTypes(): Promise<BoatType[]> {
  const res = await fetch(`${API_URL}/api/boat-types`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

async function getTrendingQuestions(): Promise<Question[]> {
  const res = await fetch(`${API_URL}/api/questions?filter=top&limit=3`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.questions ?? [];
}

async function getRecentPosts(): Promise<Post[]> {
  const res = await fetch(`${API_URL}/api/posts?limit=3`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.posts ?? [];
}

export default async function HomePage() {
  const [{ articles, total: articleTotal }, boatTypes, trendingQuestions, recentPosts, stats] = await Promise.all([
    getArticles(),
    getBoatTypes(),
    getTrendingQuestions(),
    getRecentPosts(),
    getStats(),
  ]);

  return (
    <div className="container">
      {/* Welcome Header */}
      <div style={{ marginBottom: "2rem", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
            Welcome to sailvlog
          </h1>
          <p style={{ color: "var(--fg-mute)", fontSize: "0.9rem" }}>
            The knowledge exchange for sailors. Articles · Q&amp;A · Feed · Courses.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--fg-mute)" }}>
          <span style={{ padding: "0.3rem 0.6rem", background: "var(--paper-2, rgba(0,0,0,0.04))", borderRadius: 6 }}>
            {articleTotal > 0 ? articleTotal : "—"} articles
          </span>
          <span style={{ padding: "0.3rem 0.6rem", background: "var(--paper-2, rgba(0,0,0,0.04))", borderRadius: 6 }}>
            {stats.questions > 0 ? stats.questions : "—"} Q&amp;A
          </span>
          <span style={{ padding: "0.3rem 0.6rem", background: "var(--paper-2, rgba(0,0,0,0.04))", borderRadius: 6 }}>
            {stats.posts > 0 ? stats.posts : "—"} posts
          </span>
        </div>
      </div>

      <div className="layout-two-col">
        <div>
          {/* Latest Articles */}
          <div className="section-head">
            <h2 className="section-head-title">Latest Articles</h2>
            <Link href="/articles" className="section-head-action">View All</Link>
          </div>
          <div className="stagger">
            {articles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">▲</div>
                <p className="empty-state-text">NO ARTICLES YET // 最初の一本を投稿しよう</p>
              </div>
            ) : (
              articles.map((a) => <ArticleCard key={a.id} article={a} />)
            )}
          </div>

          <div className="wave-divider" aria-hidden="true" />

          {/* Trending Questions */}
          <div className="section-head">
            <h2 className="section-head-title">Trending Questions</h2>
            <Link href="/questions" className="section-head-action">All Q&amp;A</Link>
          </div>
          <div className="stagger">
            {trendingQuestions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">○</div>
                <p className="empty-state-text">NO QUESTIONS YET // 最初の質問者になろう</p>
              </div>
            ) : (
              trendingQuestions.map((q) => {
                const hasAccepted = q.answers.some((a) => a.isAccepted);
                return (
                  <Link
                    key={q.id}
                    href={`/questions/${q.id}`}
                    className="question-card"
                    style={{
                      display: "grid",
                      borderLeft: hasAccepted ? "3px solid var(--sage)" : undefined,
                      paddingLeft: hasAccepted ? "calc(1.5rem - 3px)" : undefined,
                    }}
                  >
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
                    </div>
                    <div className="question-main">
                      <h3 className="question-title">{q.title}</h3>
                      <p className="question-body">{q.body.slice(0, 100)}{q.body.length > 100 ? "…" : ""}</p>
                      <div className="question-meta">
                        {q.boatType && <span style={{ color: "var(--terra)" }}>● {q.boatType.name}</span>}
                        <span>@{q.author.username}</span>
                        <span>{timeAgo(q.createdAt)}</span>
                        <span>{q.viewCount} views</span>
                        {hasAccepted && <span className="accepted-pill">Solved</span>}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Live Feed */}
          <div className="section-head">
            <h2 className="section-head-title">Live Feed</h2>
            <Link href="/feed" className="section-head-action">Open Timeline</Link>
          </div>
          <div className="stagger">
            {recentPosts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">○</div>
                <p className="empty-state-text">NO POSTS YET // タイムラインに投稿しよう</p>
              </div>
            ) : (
              recentPosts.map((p) => {
                const color = getAvatarColor(p.author.username);
                return (
                  <article key={p.id} className="post-card">
                    <div className="post-avatar" style={{ color }}>
                      {p.author.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="post-header">
                        <Link href={`/users/${p.author.username}`} className="post-author">{p.author.username}</Link>
                        <span className="post-handle">@{p.author.username}</span>
                        <span className="post-time">{timeAgo(p.createdAt)}</span>
                      </div>
                      <div className="post-body">{p.body}</div>
                      <div className="post-actions">
                        <span>♥ {p._count.likes}</span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="sidebar">
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

          <div className="module">
            <h3 className="sidebar-title">Sailing Tips</h3>
            <ul className="sidebar-list" style={{ fontSize: "0.85rem", color: "var(--fg-mute)", lineHeight: 1.8 }}>
              <li>艇種・風速を記事に書こう</li>
              <li>Q&amp;Aで仲間に聞いてみよう</li>
              <li>Feedで今日の練習を共有</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
