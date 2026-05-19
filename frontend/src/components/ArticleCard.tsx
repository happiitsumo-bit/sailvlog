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
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `var(--class-${article.boatType.slug}, var(--terra))`,
          borderRadius: "var(--radius) var(--radius) 0 0",
        }}
      />
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
        <div className="article-stats" aria-label="Article stats">
          <span className="article-stat" title="Likes" aria-label={`${article._count.likes} likes`}>
            <span aria-hidden style={{ color: "var(--terra)" }}>♥</span>
            <span>{article._count.likes}</span>
          </span>
          <span className="article-stat" title="Comments" aria-label={`${article._count.comments} comments`}>
            <span aria-hidden style={{ color: "var(--sage)" }}>💬</span>
            <span>{article._count.comments}</span>
          </span>
          <span className="article-stat" title="Views" aria-label={`${article.viewCount} views`}>
            <span aria-hidden style={{ color: "var(--fg-dim)" }}>👁</span>
            <span>{article.viewCount}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
