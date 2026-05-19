import Link from "next/link";
import { ArticleSummary } from "@/types";

interface Props {
  article: ArticleSummary;
}

export default function ArticleCard({ article }: Props) {
  const date = new Date(article.createdAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/\//g, ".");

  return (
    <article className="article-card">
      <div className="article-card-header">
        <span className="boat-badge" data-class={article.boatType.slug}>
          {article.boatType.name}
        </span>
        <span className="article-date">{date}</span>
      </div>
      <h2 className="article-card-title">
        <Link href={`/articles/${article.slug}`}>{article.title}</Link>
      </h2>
      <div className="article-card-tags">
        {article.tags.map(({ tag }) => (
          <Link key={tag.id} href={`/tag/${tag.slug}`} className="tag">
            {tag.name}
          </Link>
        ))}
      </div>
      <div className="article-card-footer">
        <Link href={`/users/${article.author.username}`} className="author-link">
          <span className="author-avatar-sm">
            {article.author.username.slice(0, 1).toUpperCase()}
          </span>
          @{article.author.username}
        </Link>
        <div className="article-stats">
          <span title="いいね" aria-label={`${article._count.likes}いいね`}>♥ {article._count.likes}</span>
          <span title="コメント" aria-label={`${article._count.comments}コメント`}>💬 {article._count.comments}</span>
          <span title="閲覧数" aria-label={`${article.viewCount}閲覧`}>👁 {article.viewCount}</span>
        </div>
      </div>
    </article>
  );
}
