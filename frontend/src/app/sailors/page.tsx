"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { mockSailors, mockBoatTypes } from "@/lib/mock";

const BADGE_VARIANTS = ["", "cyan", "lime"];

export default function SailorsPage() {
  const [query, setQuery] = useState("");
  const [boat, setBoat] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return mockSailors.filter((s) => {
      const matchBoat = !boat || s.boatType.toLowerCase() === boat;
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        s.displayName.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.specialty.toLowerCase().includes(q) ||
        s.affiliation.toLowerCase().includes(q);
      return matchBoat && matchQuery;
    });
  }, [query, boat]);

  return (
    <div className="container">
      <div className="page-header">
        <Link href="/" className="page-header-back">Home</Link>
        <h1 className="page-header-title">
          Sailors <span style={{ color: "var(--sage)", fontFamily: "var(--font-mono)", fontSize: "1rem", marginLeft: "0.5rem" }}>// {filtered.length} found</span>
        </h1>
        <p className="page-header-sub">艇種・専門分野・所属からセーラーを探す。</p>
      </div>

      {/* Search input */}
      <div className="composer" style={{ marginBottom: "1.25rem" }}>
        <input
          type="text"
          placeholder="Search by name, specialty, club..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--fg)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.95rem",
            padding: 0,
          }}
        />
      </div>

      <div className="filter-bar">
        <button
          className={`filter-chip ${boat === null ? "active" : ""}`}
          onClick={() => setBoat(null)}
        >
          All Boats
        </button>
        {mockBoatTypes.map((bt) => (
          <button
            key={bt.slug}
            className={`filter-chip ${boat === bt.slug ? "active" : ""}`}
            onClick={() => setBoat(bt.slug)}
          >
            {bt.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">○</div>
          <p className="empty-state-text">NO SAILORS MATCH // 検索条件を変えてみよう</p>
        </div>
      ) : (
        <div className="sailor-grid stagger">
          {filtered.map((s, idx) => (
            <Link
              key={s.id}
              href={`/users/${s.username}`}
              className="sailor-card"
              style={{ ["--accent" as string]: s.avatarColor }}
            >
              <div className="sailor-card-top">
                <div className="sailor-avatar" style={{ color: s.avatarColor }}>
                  {s.displayName[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sailor-name">{s.displayName}</div>
                  <div className="sailor-handle">@{s.username}</div>
                </div>
              </div>
              <div className="sailor-tags">
                <span className={`boat-badge ${BADGE_VARIANTS[idx % 3]}`}>{s.boatType}</span>
                <span className="tag">{s.experienceYears}y</span>
              </div>
              <p className="sailor-specialty">{s.specialty} · {s.affiliation}</p>
              <div className="sailor-stats">
                <div>
                  <strong>{s.stats.articles}</strong>
                  <span>articles</span>
                </div>
                <div>
                  <strong>{s.stats.questions}</strong>
                  <span>Q&amp;A</span>
                </div>
                <div>
                  <strong>{s.stats.followers}</strong>
                  <span>followers</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
