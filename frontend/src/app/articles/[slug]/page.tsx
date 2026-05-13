import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import LikeButton from "@/components/LikeButton";
import BookmarkButton from "@/components/BookmarkButton";
import { Article, Comment } from "@/types";
import CommentSection from "./CommentSection";

const API_URL = process.env.API_URL ?? "http://backend:8000";

async function getArticle(slug: string): Promise<Article | null> {
  const res = await fetch(`${API_URL}/api/articles/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function getComments(slug: string): Promise<Comment[]> {
  const res = await fetch(`${API_URL}/api/articles/${slug}/comments`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default async function ArticleDetailPage({ params }: { params: { slug: string } }) {
  const [article, comments] = await Promise.all([
    getArticle(params.slug),
    getComments(params.slug),
  ]);

  if (!article) {
    return (
      <div className="container">
        <p>記事が見つかりません。</p>
        <Link href="/">トップに戻る</Link>
      </div>
    );
  }

  const date = new Date(article.createdAt).toLocaleDateString("ja-JP");

  return (
    <div className="container">
      <div className="layout-two-col">
        <article className="article-detail">
          <h1 className="article-detail-title">{article.title}</h1>

          <div className="article-detail-meta">
            <span className="boat-badge">{article.boatType.name}</span>
            <Link href={`/users/${article.author.username}`} className="author-link">
              @{article.author.username}
            </Link>
            <span className="article-date">{date}</span>
            <span style={{ color: "var(--gray-500)", fontSize: "0.85rem" }}>👁 {article.viewCount}</span>
          </div>

          <div className="article-card-tags" style={{ marginBottom: "1.5rem" }}>
            {article.tags.map(({ tag }) => (
              <Link key={tag.id} href={`/tag/${tag.slug}`} className="tag">
                #{tag.name}
              </Link>
            ))}
          </div>

          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {article.contentMd}
            </ReactMarkdown>
          </div>

          <div className="article-actions">
            <LikeButton
              slug={article.slug}
              initialCount={article._count.likes}
              initialLiked={false}
            />
            <BookmarkButton slug={article.slug} initialBookmarked={false} />
          </div>

          <CommentSection slug={article.slug} initialComments={comments} />
        </article>

        <aside className="sidebar">
          <div className="sidebar-section">
            <p className="sidebar-title">著者</p>
            <Link href={`/users/${article.author.username}`} style={{ fontWeight: 600 }}>
              @{article.author.username}
            </Link>
          </div>
          <div className="sidebar-section">
            <p className="sidebar-title">艇種</p>
            <Link href={`/boat/${article.boatType.slug}`}>{article.boatType.name}</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
