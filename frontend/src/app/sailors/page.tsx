"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Sailor, BoatType } from "@/types";
import { getAvatarColor } from "@/lib/utils";
import { SkeletonArticleCard } from "@/components/SkeletonCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function SailorsPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [boat, setBoat] = useState<string | null>(null);
  const [sailors, setSailors] = useState<Sailor[]>([]);
  const [total, setTotal] = useState(0);
  const [boatTypes, setBoatTypes] = useState<BoatType[]>([]);
  const [loading, setLoading] = useState(true);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }

  useEffect(() => {
    fetch(`${API_URL}/api/boat-types`)
      .then((r) => r.json())
      .then(setBoatTypes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (boat) params.set("boatType", boat);

    fetch(`${API_URL}/api/sailors?${params}`)
      .then((r) => r.json())
      .then((data: { sailors: Sailor[]; total: number }) => {
        setSailors(data.sailors);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQuery, boat]);

  return (
    <div className="container">
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
          Sailors
          <span style={{ color: "var(--fg-dim)", fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 500, marginLeft: "0.6rem" }}>
            // {total} found
          </span>
        </h1>
        <p style={{ color: "var(--fg-mute)", fontSize: "0.85rem" }}>
          Find sailors by boat class, specialty, or affiliation.
        </p>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search by name, specialty, club..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />
      </div>

      <div className="filter-bar">
        <button
          className={`filter-chip ${boat === null ? "active" : ""}`}
          onClick={() => setBoat(null)}
        >
          All Boats
        </button>
        {boatTypes.map((bt) => (
          <button
            key={bt.slug}
            data-class={bt.slug}
            className={`filter-chip ${boat === bt.slug ? "active" : ""}`}
            onClick={() => setBoat(bt.slug)}
          >
            {bt.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="sailor-grid">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonArticleCard key={i} />)}
        </div>
      ) : sailors.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">○</div>
          <p className="empty-state-text">NO SAILORS MATCH // 検索条件を変えてみよう</p>
        </div>
      ) : (
        <div className="sailor-grid stagger">
          {sailors.map((s) => {
            const color = getAvatarColor(s.username);
            return (
              <Link
                key={s.id}
                href={`/users/${s.username}`}
                className="sailor-card"
                style={{ ["--accent" as string]: color }}
              >
                <div className="sailor-card-top">
                  <div className="sailor-avatar" style={{ color }}>
                    {s.username[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sailor-name">@{s.username}</div>
                    {s.boatType && <div className="sailor-handle">{s.boatType.name}</div>}
                  </div>
                </div>
                <div className="sailor-tags" style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {s.boatType && <span className="boat-badge" data-class={s.boatType.slug}>{s.boatType.name}</span>}
                  {s.specialty && (
                    <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", background: "rgba(201,100,66,0.08)", color: "var(--terra)", padding: "0.2rem 0.5rem", borderRadius: 4, fontWeight: 600 }}>
                      {s.specialty}
                    </span>
                  )}
                  {s.experienceYears && (
                    <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--fg-dim)", padding: "0.2rem 0.5rem" }}>
                      {s.experienceYears}yr exp
                    </span>
                  )}
                </div>
                {s.affiliation && (
                  <p className="sailor-specialty">{s.affiliation}</p>
                )}
                <div className="sailor-stats">
                  <div>
                    <strong>{s._count.articles}</strong>
                    <span>articles</span>
                  </div>
                  <div>
                    <strong>{s._count.questions}</strong>
                    <span>Q&amp;A</span>
                  </div>
                  <div>
                    <strong>{s._count.followers}</strong>
                    <span>followers</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
