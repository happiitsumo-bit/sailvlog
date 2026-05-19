"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { BoatType, Tag } from "@/types";

export default function NewArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [boatTypeId, setBoatTypeId] = useState<number | "">("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [boatTypes, setBoatTypes] = useState<BoatType[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    api.get<BoatType[]>("/api/boat-types").then(setBoatTypes);
    api.get<Tag[]>("/api/tags").then(setTags);
  }, [router]);

  function toggleTag(id: number) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleSubmit(published: boolean) {
    if (!title.trim() || !contentMd.trim() || !boatTypeId) {
      setError("タイトル・本文・艇種は必須です");
      return;
    }
    if (title.trim().length > 200) {
      setError("タイトルは200文字以内で入力してください");
      return;
    }
    if (contentMd.trim().length > 50000) {
      setError("本文は50,000文字以内で入力してください");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.post<{ slug: string }>("/api/articles", {
        title,
        contentMd,
        boatTypeId,
        tagIds: selectedTagIds,
        isPublished: published,
      });
      router.push(`/articles/${res.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "投稿に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="editor-page">
      <div className="editor-header">
        <label htmlFor="article-title" className="sr-only">タイトル</label>
        <input
          id="article-title"
          className="editor-title-input"
          placeholder="タイトルを入力..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="editor-meta">
          <label htmlFor="article-boattype" className="sr-only">艇種</label>
          <select
            id="article-boattype"
            className="editor-select"
            value={boatTypeId}
            onChange={(e) => setBoatTypeId(Number(e.target.value))}
          >
            <option value="">艇種を選択</option>
            {boatTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>{bt.name}</option>
            ))}
          </select>
          <div className="tags-grid">
            {tags.map((t) => (
              <label key={t.id} className="tag-checkbox">
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(t.id)}
                  onChange={() => toggleTag(t.id)}
                />
                #{t.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="editor-body">
        <label htmlFor="article-content" className="sr-only">本文</label>
        <textarea
          id="article-content"
          className="editor-content"
          placeholder="Markdown で記事を書こう...&#10;&#10;## 見出し&#10;&#10;本文をここに書きます。"
          value={contentMd}
          onChange={(e) => setContentMd(e.target.value)}
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="editor-actions">
        <button className="btn btn-ghost" disabled={loading} onClick={() => handleSubmit(false)}>
          下書き保存
        </button>
        <button className="btn btn-primary" disabled={loading} onClick={() => handleSubmit(true)}>
          {loading ? "投稿中..." : "公開する"}
        </button>
      </div>
    </div>
  );
}
