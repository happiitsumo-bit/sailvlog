"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Post } from "@/types";
import { getAvatarColor } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

export default function FeedPage() {
  const [draft, setDraft] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const max = 300;

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
    try {
      const result = await api.post<{ liked: boolean; likeCount: number }>(`/api/posts/${postId}/like`, {});
      setPosts((prev) => prev.map((p, i) => i === idx ? { ...p, _count: { likes: result.likeCount } } : p));
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <Link href="/" className="page-header-back">Home</Link>
        <h1 className="page-header-title">Timeline</h1>
        <p className="page-header-sub">セーラーの今を短く共有。気付き・記録・つぶやき。</p>
      </div>

      <div className="layout-two-col">
        <div>
          <div className="composer">
            <textarea
              placeholder="今日の気付きを共有 — 風向き、セッティング、練習のメモ..."
              maxLength={max}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="composer-footer">
              <span className="composer-counter" style={{ color: draft.length > max - 30 ? "var(--terra)" : undefined }}>
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

          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon">○</div>
              <p className="empty-state-text">Loading…</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">○</div>
              <p className="empty-state-text">NO POSTS YET // 最初の投稿者になろう</p>
            </div>
          ) : (
            <div className="stagger">
              {posts.map((p, idx) => (
                <article key={p.id} className="post-card">
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
            <h3 className="sidebar-title">Stats</h3>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--fg-2)" }}>
              {total} posts total
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
