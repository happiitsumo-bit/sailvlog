import ArticleCard from "@/components/ArticleCard";
import { ArticleSummary } from "@/types";
import Link from "next/link";

const API_URL = process.env.API_URL ?? "http://backend:8000";

export default async function BoatPage({ params }: { params: { slug: string } }) {
  const res = await fetch(`${API_URL}/api/articles?boatType=${params.slug}`, { cache: "no-store" });
  const { articles }: { articles: ArticleSummary[] } = res.ok ? await res.json() : { articles: [] };

  return (
    <div className="container">
      <div style={{ marginBottom: "1.25rem" }}>
        <Link href="/" style={{ color: "var(--gray-500)", fontSize: "0.875rem" }}>← トップ</Link>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginTop: "0.5rem" }}>
          艇種：{articles[0]?.boatType.name ?? params.slug}
        </h1>
      </div>
      {articles.length === 0 ? (
        <p style={{ color: "var(--gray-500)" }}>この艇種の記事はまだありません。</p>
      ) : (
        articles.map((a) => <ArticleCard key={a.id} article={a} />)
      )}
    </div>
  );
}
