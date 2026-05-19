"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Post } from "@/types";
import { getAvatarColor, timeAgo } from "@/lib/utils";
import { SkeletonPostCard } from "@/components/SkeletonCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function FeedPage() {
  const [draft, setDraft] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const max = 300;

  useEffect(() => {
    const u = getUser();
    setUsername(u?.username ?? null);
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(`${API_URL}/api/posts`).then((r) => r.json()) as { posts: Post[]; total: number };
      setPosts(data.posts);
      setTotal(data.total);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function handlePost() {
    if (!draft.trim()) return;
    setSubmitting(true);
    setPostError(null);
    try {
      await api.post("/api/posts", { body: draft });
      setDraft("");
      fetchPosts();
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "投稿に失敗しました。ログインしているか確認してください。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLike(postId: number, idx: number) {
    setLikeError(null);
    try {
      const result = await api.post<{ liked: boolean; likeCount: number }>(`/api/posts/${postId}/like`, {});
      setPosts((prev) => prev.map((p, i) => i === idx ? { ...p, _count: { likes: result.likeCount } } : p));
    } catch (e) {
      setLikeError(e instanceof Error ? e.message : "いいねに失敗しました");
    }
  }

  const loggedIn = !!username;

  return (
    <div className="container">
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.2rem" }}>
          Timeline
        </h1>
        <p style={{ color: "var(--fg-mute)", fontSize: "0.85rem" }}>
          セーラーの今を短く共有 — 風向き、セッティング、練習のメモ。
        </p>
      </div>

      <div className="layout-two-col">
        <div>
          {loggedIn ? (
            <div className="composer" style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--terra)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {username ? username[0].toUpperCase() : "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <textarea
                    placeholder="今日の気付きを共有 — 風向き、セッティング、練習のメモ..."
                    maxLength={max}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    style={{ width: "100%" }}
                  />
                  <div className="composer-footer">
                    <span
                      className="composer-counter"
                      style={{
                        color:
                          draft.length > max - 20
                            ? "var(--terra)"
                            : draft.length > max - 50
                            ? "var(--dijon)"
                            : undefined,
                      }}
                    >
                      {draft.length} / {max}
                    </span>
                    <button
                      className="btn btn-primary"
                      disabled={draft.trim().length === 0 || submitting}
                      onClick={handlePost}
                    >
                      {submitting ? "Posting…" : "Post"}
                    </button>
                  </div>
                  {postError && (
                    <p style={{ fontSize: "0.82rem", color: "var(--terra)", marginTop: "0.5rem" }}>{postError}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="composer"
              style={{ textAlign: "center", color: "var(--fg-mute)", padding: "1.5rem", marginBottom: "1.5rem" }}
            >
              <p>
                投稿するには <Link href="/login" className="form-link">ログイン</Link> が必要です。
              </p>
            </div>
          )}

          {likeError && (
            <p style={{ fontSize: "0.82rem", color: "var(--terra)", marginBottom: "0.75rem" }}>{likeError}</p>
          )}

          {loading ? (
            <div className="stagger">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonPostCard key={i} />)}
            </div>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">○</div>
              <p className="empty-state-text">NO POSTS YET // 最初の投稿者になろう</p>
            </div>
          ) : (
            <div className="stagger">
              {posts.map((p, idx) => (
                <article
                  key={p.id}
                  className="post-card"
                  style={{ transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
                >
                  <div className="post-avatar" style={{ color: getAvatarColor(p.author.username) }}>
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
                      <button onClick={() => handleLike(p.id, idx)}>♥ {p._count.likes}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="sidebar">
          <div className="module">
            <h3 className="sidebar-title">Feed Stats</h3>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--fg-mute)" }}>
              <span className="live-dot" />{total} posts total
            </p>
          </div>
          <div className="module">
            <h3 className="sidebar-title">Post Tips</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--fg-mute)", lineHeight: 1.7 }}>
              風向き・艇種・場所を添えると仲間に伝わりやすい。<br />
              練習メモ・セッティングの記録にも使おう。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
