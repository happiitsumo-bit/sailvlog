import Link from "next/link";
import ArticleCard from "@/components/ArticleCard";
import ClassFlag from "@/components/ClassFlag";
import { ArticleSummary, BoatType, Tag } from "@/types";

const API_URL = process.env.API_URL ?? "http://backend:8000";

async function getArticles(searchParams: Record<string, string>): Promise<{ articles: ArticleSummary[]; total: number }> {
  const params = new URLSearchParams();
  if (searchParams.boatType) params.set("boatType", searchParams.boatType);
  if (searchParams.tag) params.set("tag", searchParams.tag);
  if (searchParams.page) params.set("page", searchParams.page);
  params.set("limit", "20");

  const res = await fetch(`${API_URL}/api/articles?${params}`, { cache: "no-store" });
  if (!res.ok) return { articles: [], total: 0 };
  return res.json();
}

async function getBoatTypes(): Promise<BoatType[]> {
  const res = await fetch(`${API_URL}/api/boat-types`, { cache: "force-cache" });
  if (!res.ok) return [];
  return res.json();
}

async function getTags(): Promise<Tag[]> {
  const res = await fetch(`${API_URL}/api/tags`, { cache: "force-cache" });
  if (!res.ok) return [];
  return res.json();
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const [{ articles, total }, boatTypes, tags] = await Promise.all([
    getArticles(searchParams),
    getBoatTypes(),
    getTags(),
  ]);

  const currentBoat = searchParams.boatType ?? null;
  const currentTag = searchParams.tag ?? null;
  const currentPage = Number(searchParams.page ?? 1);
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="container">
      <div className="page-header">
        <Link href="/" className="page-header-back">Home</Link>
        <h1 className="page-header-title">
          Articles <span style={{ color: "var(--fg-mute)", fontFamily: "var(--font-mono)", fontSize: "1rem", marginLeft: "0.5rem" }}>{total} posts</span>
        </h1>
        <p className="page-header-sub">セーラーたちの技術ログ・練習記録・レースレポート。</p>
      </div>

      <div className="layout-two-col">
        <div>
          <div className="filter-bar">
            <Link href="/articles" className={`filter-chip ${!currentBoat && !currentTag ? "active" : ""}`}>All</Link>
            {boatTypes.map((bt) => (
              <Link
                key={bt.slug}
                href={`/articles?boatType=${bt.slug}`}
                className={`filter-chip ${currentBoat === bt.slug ? "active" : ""}`}
              >
                {bt.name}
              </Link>
            ))}
            <div style={{ marginLeft: "auto" }}>
              <Link href="/articles/new" className="btn btn-primary">+ Write</Link>
            </div>
          </div>

          {articles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">▲</div>
              <p className="empty-state-text">NO ARTICLES YET // 最初の一本を投稿しよう</p>
            </div>
          ) : (
            <div className="stagger">
              {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "2rem" }}>
              {currentPage > 1 && (
                <Link
                  href={`/articles?${new URLSearchParams({ ...searchParams, page: String(currentPage - 1) })}`}
                  className="btn btn-ghost"
                >
                  ← Prev
                </Link>
              )}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--fg-mute)", display: "flex", alignItems: "center", padding: "0 0.75rem" }}>
                {currentPage} / {totalPages}
              </span>
              {currentPage < totalPages && (
                <Link
                  href={`/articles?${new URLSearchParams({ ...searchParams, page: String(currentPage + 1) })}`}
                  className="btn btn-ghost"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </div>

        <aside className="sidebar">
          <div className="module">
            <h3 className="sidebar-title">By Yacht</h3>
            <ul className="sidebar-list">
              {boatTypes.map((bt) => (
                <li key={bt.slug}>
                  <Link href={`/articles?boatType=${bt.slug}`} className="yacht-row">
                    <ClassFlag slug={bt.slug} />
                    <span>{bt.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {tags.length > 0 && (
            <div className="module">
              <h3 className="sidebar-title">Tags</h3>
              <div className="tag-cloud">
                {tags.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/articles?tag=${t.slug}`}
                    className={`tag-pill ${currentTag === t.slug ? "active" : ""}`}
                  >
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
