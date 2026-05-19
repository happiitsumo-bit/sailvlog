import Link from "next/link";
import { ArticleSummary, BoatType } from "@/types";

const API_URL = process.env.API_URL ?? "http://backend:8000";

interface UserProfile {
  id: number;
  username: string;
  bio?: string;
  avatarUrl?: string;
  specialty?: string;
  affiliation?: string;
  experienceYears?: number;
  boatType?: BoatType;
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
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
          Profile
        </h1>
        <p style={{ color: "var(--fg-mute)", fontSize: "0.85rem" }}>
          @{user.username}
        </p>
      </div>

      <div
        style={{
          position: "relative",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "1.5rem 1.75rem",
          marginBottom: "2rem",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <Link
          href={`/users/${user.username}/edit`}
          className="btn btn-ghost"
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.25rem",
            fontSize: "0.78rem",
            padding: "0.35rem 0.85rem",
          }}
        >
          Edit Profile
        </Link>

        <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="profile-avatar-lg">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 className="profile-username" style={{ marginBottom: "0.5rem" }}>@{user.username}</h2>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
              {user.boatType && (
                <span className="boat-badge" data-class={user.boatType.slug}>{user.boatType.name}</span>
              )}
              {user.specialty && (
                <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", background: "rgba(201,100,66,0.08)", color: "var(--terra)", padding: "0.2rem 0.5rem", borderRadius: 4, fontWeight: 600 }}>
                  {user.specialty}
                </span>
              )}
              {user.experienceYears && (
                <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--fg-dim)", padding: "0.2rem 0.5rem" }}>
                  {user.experienceYears}yr exp
                </span>
              )}
            </div>

            {user.bio && <p className="profile-bio" style={{ marginBottom: "0.5rem" }}>{user.bio}</p>}

            {user.affiliation && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--fg-mute)" }}>
                {user.affiliation}
              </p>
            )}

            <div className="profile-stats" style={{ marginTop: "1rem" }}>
              <span><strong>{user._count.articles}</strong> articles</span>
              <span><strong>{user._count.followers}</strong> followers</span>
              <span><strong>{user._count.following}</strong> following</span>
            </div>
          </div>
        </div>
      </div>

      <p className="section-title">Articles</p>

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
