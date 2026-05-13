"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

interface Props {
  slug: string;
  initialBookmarked: boolean;
}

export default function BookmarkButton({ slug, initialBookmarked }: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  async function toggle() {
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
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`bookmark-btn ${bookmarked ? "bookmarked" : ""}`}
    >
      {bookmarked ? "🔖 保存済み" : "🔖 ブックマーク"}
    </button>
  );
}
