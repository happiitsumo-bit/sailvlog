"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

interface Props {
  slug: string;
  initialBookmarked: boolean;
}

export default function BookmarkButton({ slug, initialBookmarked }: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);

  const toggle = useCallback(async () => {
    if (!isLoggedIn()) {
      alert("ブックマークにはログインが必要です");
      return;
    }
    setLoading(true);
    try {
      if (bookmarked) {
        await api.delete(`/api/articles/${slug}/bookmark`);
        setBookmarked(false);
      } else {
        await api.post(`/api/articles/${slug}/bookmark`, {});
        setBookmarked(true);
        // ブックマーク追加時にポップアニメーションを発火
        setAnimating(true);
        setTimeout(() => setAnimating(false), 350);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [bookmarked, slug]);

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={[
        "bookmark-btn",
        bookmarked ? "bookmarked" : "",
        animating ? "bookmark-pop-anim" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="bookmark-icon">{bookmarked ? "🔖" : "🕮"}</span>
      {bookmarked ? "保存済み" : "ブックマーク"}
    </button>
  );
}
