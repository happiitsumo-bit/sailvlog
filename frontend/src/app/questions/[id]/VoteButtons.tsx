"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  type: "question" | "answer";
  targetId: number;        // question の場合は questionId、answer の場合は answerId
  questionId?: number;     // answer の場合に必要
  initialVotes: number;
}

export default function VoteButtons({ type, targetId, questionId, initialVotes }: Props) {
  const [votes, setVotes] = useState(initialVotes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vote(value: 1 | -1) {
    setLoading(true);
    setError(null);
    try {
      const path =
        type === "question"
          ? `/api/questions/${targetId}/vote`
          : `/api/questions/${questionId}/answers/${targetId}/vote`;
      const result = await api.post<{ voteCount: number }>(path, { value });
      setVotes(result.voteCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "投票に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
      <button
        className="btn btn-ghost"
        style={{ padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}
        onClick={() => vote(1)}
        disabled={loading}
      >
        ▲
      </button>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 700, color: "var(--fg)" }}>
        {votes}
      </div>
      <button
        className="btn btn-ghost"
        style={{ padding: "0.3rem 0.5rem", fontSize: "0.85rem" }}
        onClick={() => vote(-1)}
        disabled={loading}
      >
        ▼
      </button>
      {error && (
        <span style={{ fontSize: "0.65rem", color: "var(--terra)", textAlign: "center", maxWidth: 44 }}>
          {error}
        </span>
      )}
    </div>
  );
}
