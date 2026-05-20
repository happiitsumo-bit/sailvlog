"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { TeamSummary, TeamCategory, TEAM_CATEGORY_LABEL } from "@/types";
import { SkeletonArticleCard } from "@/components/SkeletonCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const CATEGORY_FILTERS: { value: TeamCategory | null; label: string }[] = [
  { value: null, label: "すべて" },
  { value: "university", label: "大学" },
  { value: "club", label: "クラブ" },
  { value: "professional", label: "実業団" },
];

export default function TeamsPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [category, setCategory] = useState<TeamCategory | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("search", debouncedQuery.trim());
    if (category) params.set("category", category);

    fetch(`${API_URL}/api/teams?${params}`)
      .then((r) => r.json())
      .then((data: { teams: TeamSummary[]; total: number }) => {
        setTeams(data.teams ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQuery, category]);

  return (
    <div className="container">
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
          Teams
          <span style={{ color: "var(--fg-dim)", fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 500, marginLeft: "0.6rem" }}>
            // {total} found
          </span>
        </h1>
        <p style={{ color: "var(--fg-mute)", fontSize: "0.85rem" }}>
          大学ヨット部・クラブチームの技術アーカイブ。
        </p>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="チーム名・大学名・地域で検索..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />
      </div>

      <div className="filter-bar">
        {CATEGORY_FILTERS.map(({ value, label }) => (
          <button
            key={value ?? "all"}
            className={`filter-chip ${category === value ? "active" : ""}`}
            onClick={() => setCategory(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="sailor-grid">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonArticleCard key={i} />)}
        </div>
      ) : teams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◈</div>
          <p className="empty-state-text">NO TEAMS FOUND // 条件を変えてみよう</p>
        </div>
      ) : (
        <div className="sailor-grid stagger">
          {teams.map((t) => (
            <Link key={t.id} href={`/teams/${t.slug}`} className="sailor-card">
              <div className="sailor-card-top">
                <div
                  className="sailor-avatar"
                  style={{ color: "var(--sage)", fontSize: "1.2rem" }}
                >
                  ◈
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sailor-name">{t.name}</div>
                  <div className="sailor-handle">
                    {t.region && `${t.region} · `}{TEAM_CATEGORY_LABEL[t.category]}
                  </div>
                </div>
              </div>

              {t.bio && (
                <p style={{ fontSize: "0.82rem", color: "var(--fg-mute)", lineHeight: 1.6, margin: "0.5rem 0" }}>
                  {t.bio.slice(0, 80)}{t.bio.length > 80 ? "…" : ""}
                </p>
              )}

              <div className="sailor-stats">
                <div>
                  <strong>{t._count.members}</strong>
                  <span>members</span>
                </div>
                <div>
                  <strong>{t._count.articles}</strong>
                  <span>articles</span>
                </div>
                <div>
                  <strong>{t._count.questions}</strong>
                  <span>Q&amp;A</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
