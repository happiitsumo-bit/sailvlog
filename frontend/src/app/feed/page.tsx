"use client";

import Link from "next/link";
import { useState } from "react";
import { mockPosts, mockHotTags, mockSailors, timeAgo } from "@/lib/mock";

export default function FeedPage() {
  const [draft, setDraft] = useState("");
  const max = 300;

  return (
    <div className="container">
      <div className="page-header">
        <Link href="/" className="page-header-back">Home</Link>
        <h1 className="page-header-title">Timeline</h1>
        <p className="page-header-sub">セーラーの今を短く共有。気付き・記録・つぶやき。</p>
      </div>

      <div className="layout-two-col">
        <div>
          {/* Composer */}
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
              <button className="btn btn-primary" disabled={draft.trim().length === 0}>Post</button>
            </div>
          </div>

          {/* Filter chips */}
          <div className="filter-bar">
            <button className="filter-chip active">All</button>
            <button className="filter-chip">Following</button>
            <button className="filter-chip">470</button>
            <button className="filter-chip">ILCA</button>
            <button className="filter-chip">Cruiser</button>
          </div>

          {/* Timeline */}
          <div className="stagger">
            {mockPosts.map((p) => (
              <article key={p.id} className="post-card">
                <div className="post-avatar" style={{ color: p.author.avatarColor }}>
                  {p.author.displayName.slice(0, 1)}
                </div>
                <div>
                  <div className="post-header">
                    <Link href={`/users/${p.author.username}`} className="post-author">{p.author.displayName}</Link>
                    <span className="post-handle">@{p.author.username}</span>
                    <span className="post-time">{timeAgo(p.createdAt)}</span>
                  </div>
                  <div className="post-body">{p.body}</div>
                  <div className="post-actions">
                    <button>♥ {p.likeCount}</button>
                    <button className="cyan">◐ {p.replyCount}</button>
                    <button>⤴ Share</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="sidebar">
          <div className="module">
            <h3 className="sidebar-title">Who to Follow</h3>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {mockSailors.slice(0, 3).map((s) => (
                <li key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                  <div className="author-avatar-sm" style={{ width: 32, height: 32, color: s.avatarColor, fontSize: "0.8rem" }}>
                    {s.displayName[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/users/${s.username}`} style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.displayName}
                    </Link>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--fg-mute)" }}>
                      {s.boatType} · {s.experienceYears}y
                    </span>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: "0.3rem 0.7rem", fontSize: "0.7rem" }}>+ Follow</button>
                </li>
              ))}
            </ul>
          </div>

          <div className="module">
            <h3 className="sidebar-title">Trending Tags</h3>
            <div className="tag-cloud">
              {mockHotTags.slice(0, 6).map((t) => (
                <Link key={t.name} href={`/tag/${t.name}`} className="tag-pill">
                  {t.name}<span className="tcount">{t.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
