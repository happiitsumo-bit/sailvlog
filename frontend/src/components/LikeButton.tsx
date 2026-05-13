"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";

interface Props {
  slug: string;
  initialCount: number;
  initialLiked: boolean;
}

export default function LikeButton({ slug, initialCount, initialLiked }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!isLoggedIn()) {
      alert("いいねにはログインが必要です");
      return;
    }
    setLoading(true);
    try {
      if (liked) {
        const res = await api.delete<{ liked: boolean; count: number }>(
          `/api/articles/${slug}/like`
        );
        setLiked(res.liked);
        setCount(res.count);
      } else {
        const res = await api.post<{ liked: boolean; count: number }>(
          `/api/articles/${slug}/like`,
          {}
        );
        setLiked(res.liked);
        setCount(res.count);
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
      className={`like-btn ${liked ? "liked" : ""}`}
    >
      ❤️ {count}
    </button>
  );
}
