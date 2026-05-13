import ArticleCard from "@/components/ArticleCard";
import ClassFlag from "@/components/ClassFlag";
import Link from "next/link";
import { ArticleSummary, BoatType } from "@/types";
import {
  mockStats,
  mockPosts,
  mockHotTags,
  mockBoatTypes,
  mockQuestions,
  timeAgo,
} from "@/lib/mock";

const API_URL = process.env.API_URL ?? "http://backend:8000";

async function getArticles(): Promise<{ articles: ArticleSummary[] }> {
  const res = await fetch(`${API_URL}/api/articles`, { cache: "no-store" });
  if (!res.ok) return { articles: [] };
  return res.json();
}

async function getBoatTypes(): Promise<BoatType[]> {
  const res = await fetch(`${API_URL}/api/boat-types`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default async function HomePage() {
  const [{ articles }, boatTypesFromApi] = await Promise.all([
    getArticles(),
    getBoatTypes(),
  ]);

  const boatTypes = boatTypesFromApi.length > 0 ? boatTypesFromApi : mockBoatTypes;
  const recentPosts = mockPosts.slice(0, 3);
  const trendingQuestions = mockQuestions.slice(0, 3);

  return (
    <>
      {/* ===== HERO ===== */}
      <section className="hero">
        <span className="hero-corner">Northwest · 14kt · SE</span>

        <div className="hero-inner">
          <p className="hero-eyebrow">
            For dinghy &amp; cruiser sailors · <span className="accent">Est. 2024</span>
          </p>

          <h1 className="hero-title">
            A technical exchange where the <em>wind reads you</em> — and you read it back.
          </h1>

          <p className="hero-sub">
            セーラーのための技術交流プラットフォーム。
            記事・Q&A・タイムライン・学習コースが一つに。
            あなたの帆走経験を、次の世代へ。
          </p>

          <div className="hero-cta-group">
            <Link href="/questions" className="btn btn-primary">
              Ask the fleet →
            </Link>
            <Link href="/articles" className="btn btn-ghost">
              Browse logs
            </Link>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-label">Total Sailors</div>
              <div className="hero-stat-value">{mockStats.totalSailors.toLocaleString()}</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-label">Articles</div>
              <div className="hero-stat-value">{mockStats.totalArticles.toLocaleString()}</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-label">Questions</div>
              <div className="hero-stat-value">{mockStats.totalQuestions.toLocaleString()}</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-label">Active Now</div>
              <div className="hero-stat-value">
                <span className="live-dot" />{mockStats.activeNow}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MAIN ===== */}
      <div className="container">
        <div className="layout-two-col">
          <div>
            {/* Articles */}
            <div className="section-head">
              <h2 className="section-head-title">Latest Articles</h2>
              <Link href="/boat/470" className="section-head-action">View All</Link>
            </div>
            <div className="stagger">
              {articles.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">▲</div>
                  <p className="empty-state-text">NO ARTICLES YET // 最初の一本を投稿しよう</p>
                </div>
              ) : (
                articles.slice(0, 5).map((a) => <ArticleCard key={a.id} article={a} />)
              )}
            </div>

            {/* Trending Questions */}
            <div className="section-head" style={{ marginTop: "3rem" }}>
              <h2 className="section-head-title">Trending Questions</h2>
              <Link href="/questions" className="section-head-action">All Q&amp;A</Link>
            </div>
            <div className="stagger">
              {trendingQuestions.map((q) => (
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
                  </div>
                  <div className="question-main">
                    <h3 className="question-title">{q.title}</h3>
                    <p className="question-body">{q.body}</p>
                    <div className="question-meta">
                      <span style={{ color: "var(--terra)" }}>● {q.boatType}</span>
                      <span>@{q.author.username}</span>
                      <span>{timeAgo(q.createdAt)}</span>
                      <span>{q.views} views</span>
                      {q.hasAcceptedAnswer && <span className="accepted-pill">Solved</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Live Feed */}
            <div className="section-head" style={{ marginTop: "3rem" }}>
              <h2 className="section-head-title">Live Feed</h2>
              <Link href="/feed" className="section-head-action">Open Timeline</Link>
            </div>
            <div className="stagger">
              {recentPosts.map((p) => (
                <article key={p.id} className="post-card">
                  <div className="post-avatar" style={{ color: p.author.avatarColor }}>
                    {p.author.displayName.slice(0, 1)}
                  </div>
                  <div>
                    <div className="post-header">
                      <span className="post-author">{p.author.displayName}</span>
                      <span className="post-handle">@{p.author.username}</span>
                      <span className="post-time">{timeAgo(p.createdAt)}</span>
                    </div>
                    <div className="post-body">{p.body}</div>
                    <div className="post-actions">
                      <span>♥ {p.likeCount}</span>
                      <span>◐ {p.replyCount}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="sidebar">
            <div className="module">
              <h3 className="sidebar-title">Today</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 500, color: "var(--terra)", lineHeight: 1 }}>
                    {mockStats.todayArticles}
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "var(--fg-mute)", marginTop: "0.3rem" }}>
                    new articles
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 500, color: "var(--sage)", lineHeight: 1 }}>
                    {mockStats.todayPosts}
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "var(--fg-mute)", marginTop: "0.3rem" }}>
                    posts
                  </div>
                </div>
              </div>
            </div>

            <div className="module">
              <h3 className="sidebar-title">Yachts</h3>
              <ul className="sidebar-list">
                {boatTypes.slice(0, 6).map((bt) => {
                  const isMock = "count" in bt;
                  return (
                    <li key={bt.slug}>
                      <Link href={`/boat/${bt.slug}`} className="yacht-row">
                        <ClassFlag slug={bt.slug} />
                        <span>{bt.name}</span>
                        {isMock && <span className="count">{(bt as { count: number }).count}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="module">
              <h3 className="sidebar-title">Hot Tags</h3>
              <div className="tag-cloud">
                {mockHotTags.slice(0, 8).map((t) => (
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
    </>
  );
}
