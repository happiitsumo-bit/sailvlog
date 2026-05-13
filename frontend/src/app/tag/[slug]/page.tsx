import ArticleCard from "@/components/ArticleCard";
import { ArticleSummary } from "@/types";
import Link from "next/link";

const API_URL = process.env.API_URL ?? "http://backend:8000";

export default async function TagPage({ params }: { params: { slug: string } }) {
  const res = await fetch(`${API_URL}/api/articles?tag=${params.slug}`, { cache: "no-store" });
  const { articles }: { articles: ArticleSummary[] } = res.ok ? await res.json() : { articles: [] };

  const tagName = articles[0]?.tags.find((t) => t.tag.slug === params.slug)?.tag.name ?? params.slug;

  return (
    <div className="container">
      <div style={{ marginBottom: "1.25rem" }}>
        <Link href="/" style={{ color: "var(--gray-500)", fontSize: "0.875rem" }}>← トップ</Link>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "0.5rem" }}>
          #{tagName}
        </h1>
      </div>
      {articles.length === 0 ? (
        <p style={{ color: "var(--gray-500)" }}>このタグの記事はまだありません。</p>
      ) : (
        articles.map((a) => <ArticleCard key={a.id} article={a} />)
      )}
    </div>
  );
}
