"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { Comment } from "@/types";

interface Props {
  slug: string;
  initialComments: Comment[];
}

export default function CommentSection({ slug, initialComments }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoggedIn()) { alert("コメントにはログインが必要です"); return; }
    if (!content.trim()) return;
    setLoading(true);
    try {
      const comment = await api.post<Comment>(`/api/articles/${slug}/comments`, { content });
      setComments((prev) => [...prev, comment]);
      setContent("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="comments-section">
      <h2 className="comments-title">コメント {comments.length}件</h2>

      {comments.map((c) => (
        <div key={c.id} className="comment-item">
          <div className="comment-avatar">
            {c.author.username.slice(0, 1).toUpperCase()}
          </div>
          <div className="comment-body">
            <div className="comment-header">
              <span className="comment-author">@{c.author.username}</span>
              <span className="comment-date">{new Date(c.createdAt).toLocaleDateString("ja-JP")}</span>
            </div>
            <p className="comment-content">{c.content}</p>
          </div>
        </div>
      ))}

      <form className="comment-form" onSubmit={handleSubmit}>
        <textarea
          placeholder="コメントを入力..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="comment-form-actions">
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "投稿中..." : "コメントを投稿"}
          </button>
        </div>
      </form>
    </div>
  );
}
