"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function AnswerComposer({ questionId }: { questionId: number }) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/api/questions/${questionId}/answers`, { body });
      setBody("");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "投稿に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="composer" style={{ marginTop: "2rem" }}>
      <h3 className="sidebar-title" style={{ marginBottom: "1rem" }}>Your Answer</h3>
      <textarea
        placeholder="Markdown supported. 体験ベースで具体的に書くと役立ちます。"
        rows={6}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="composer-footer">
        <span className="composer-counter">Markdown // ↵ to break</span>
        <button
          className="btn btn-primary"
          disabled={body.trim().length === 0 || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Posting…" : "Post Answer"}
        </button>
      </div>
    </div>
  );
}
