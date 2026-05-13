import Link from "next/link";
import { ArticleSummary, BoatType } from "@/types";

const API_URL = process.env.API_URL ?? "http://backend:8000";

interface UserProfile {
  id: number;
  username: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
  _count: { articles: number; followers: number; following: number };
  articles: (Pick<ArticleSummary, "id" | "title" | "slug" | "createdAt"> & {
    boatType: Pick<BoatType, "name" | "slug">;
    _count: { likes: number };
  })[];
}

export default async function UserProfilePage({ params }: { params: { username: string } }) {
  const res = await fetch(`${API_URL}/api/users/${params.username}`, { cache: "no-store" });

  if (!res.ok) {
    return (
      <div className="container">
        <p>ユーザーが見つかりません。</p>
        <Link href="/">トップに戻る</Link>
      </div>
    );
  }

  const user: UserProfile = await res.json();

  return (
    <div className="container">
      <div className="profile-header">
        <div className="profile-avatar-lg">
          {user.username.slice(0, 1).toUpperCase()}
        </div>
        <div className="profile-info">
          <h1 className="profile-username">@{user.username}</h1>
          {user.bio && <p className="profile-bio">{user.bio}</p>}
          <div className="profile-stats">
            <span><strong>{user._count.articles}</strong> 記事</span>
            <span><strong>{user._count.followers}</strong> フォロワー</span>
            <span><strong>{user._count.following}</strong> フォロー中</span>
          </div>
        </div>
      </div>

      <p className="section-title">投稿記事</p>

      {user.articles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⛵</div>
          <p className="empty-state-text">まだ記事がありません</p>
        </div>
      ) : (
        user.articles.map((a) => (
          <div key={a.id} className="article-card">
            <div className="article-card-header">
              <span className="boat-badge">{a.boatType.name}</span>
              <span className="article-date">{new Date(a.createdAt).toLocaleDateString("ja-JP")}</span>
            </div>
            <h3 className="article-card-title">
              <Link href={`/articles/${a.slug}`}>{a.title}</Link>
            </h3>
            <div className="article-stats" style={{ justifyContent: "flex-end" }}>
              <span>❤️ {a._count.likes}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
