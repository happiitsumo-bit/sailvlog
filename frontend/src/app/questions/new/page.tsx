"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { BoatType, Tag } from "@/types";

export default function NewQuestionPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [boatTypeId, setBoatTypeId] = useState<number | "">("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [boatTypes, setBoatTypes] = useState<BoatType[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    api.get<BoatType[]>("/api/boat-types").then(setBoatTypes).catch(() => {});
    api.get<Tag[]>("/api/tags").then(setTags).catch(() => {});
  }, [router]);

  function toggleTag(tagId: number) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (title.trim().length > 200) {
      alert("タイトルは200文字以内で入力してください");
      return;
    }
    if (body.trim().length > 20000) {
      alert("本文は20,000文字以内で入力してください");
      return;
    }
    setSubmitting(true);
    try {
      const q = await api.post<{ id: number }>("/api/questions", {
        title,
        body,
        boatTypeId: boatTypeId || null,
        tagIds: selectedTagIds,
      });
      router.push(`/questions/${q.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "投稿に失敗しました。ログインしているか確認してください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <Link href="/questions" className="page-header-back">Questions</Link>
        <h1 className="page-header-title">Ask a Question</h1>
        <p className="page-header-sub">艇種・タグを設定するほど、詳しいセーラーに届きやすくなります。</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--fg-mute)", marginBottom: "0.5rem", letterSpacing: "0.1em" }}>
            TITLE *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="具体的な疑問をタイトルに（例: 470強風時のジブシートのテンション調整）"
            required
            style={{
              width: "100%",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.85rem 1rem",
              color: "var(--fg)",
              fontSize: "1rem",
              fontFamily: "var(--font-body)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--fg-mute)", marginBottom: "0.5rem", letterSpacing: "0.1em" }}>
            DETAIL *
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="状況・試したこと・知りたいことを詳しく書くほど回答が集まります。Markdown使用可。"
            rows={10}
            required
            style={{
              width: "100%",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.85rem 1rem",
              color: "var(--fg)",
              fontSize: "0.95rem",
              fontFamily: "var(--font-mono)",
              lineHeight: 1.7,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--fg-mute)", marginBottom: "0.5rem", letterSpacing: "0.1em" }}>
            BOAT TYPE
          </label>
          <select
            value={boatTypeId}
            onChange={(e) => setBoatTypeId(e.target.value ? Number(e.target.value) : "")}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              color: "var(--fg)",
              fontSize: "0.9rem",
              fontFamily: "var(--font-body)",
              minWidth: 200,
            }}
          >
            <option value="">艇種を選択（任意）</option>
            {boatTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>{bt.name}</option>
            ))}
          </select>
        </div>

        {tags.length > 0 && (
          <div>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--fg-mute)", marginBottom: "0.75rem", letterSpacing: "0.1em" }}>
              TAGS
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={selectedTagIds.includes(t.id) ? "tag" : "filter-chip"}
                  style={{ cursor: "pointer" }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
          <Link href="/questions" className="btn btn-ghost">Cancel</Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!title.trim() || !body.trim() || submitting}
          >
            {submitting ? "Posting…" : "Post Question"}
          </button>
        </div>
      </form>
    </div>
  );
}
