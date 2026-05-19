"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { Sailor, BoatType } from "@/types";
import { getAvatarColor } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function SailorsPage() {
  const [query, setQuery] = useState("");
  const [boat, setBoat] = useState<string | null>(null);
  const [sailors, setSailors] = useState<Sailor[]>([]);
  const [total, setTotal] = useState(0);
  const [boatTypes, setBoatTypes] = useState<BoatType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/boat-types`)
      .then((r) => r.json())
      .then(setBoatTypes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (boat) params.set("boatType", boat);

    fetch(`${API_URL}/api/sailors?${params}`)
      .then((r) => r.json())
      .then((data: { sailors: Sailor[]; total: number }) => {
        setSailors(data.sailors);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query, boat]);

  return (
    <div className="container">
      <div className="page-header">
        <Link href="/" className="page-header-back">Home</Link>
        <h1 className="page-header-title">
          Sailors <span style={{ color: "var(--sage)", fontFamily: "var(--font-mono)", fontSize: "1rem", marginLeft: "0.5rem" }}>// {total} found</span>
        </h1>
        <p className="page-header-sub">艇種・専門分野・所属からセーラーを探す。</p>
      </div>

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
        {boatTypes.map((bt) => (
          <button
            key={bt.slug}
            className={`filter-chip ${boat === bt.slug ? "active" : ""}`}
            onClick={() => setBoat(bt.slug)}
          >
            {bt.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="empty-state-icon">○</div>
          <p className="empty-state-text">Loading…</p>
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
                <div className="sailor-tags">
                  {s.boatType && <span className="boat-badge">{s.boatType.name}</span>}
                  {s.experienceYears && <span className="tag">{s.experienceYears}y</span>}
                </div>
                {(s.specialty || s.affiliation) && (
                  <p className="sailor-specialty">
                    {[s.specialty, s.affiliation].filter(Boolean).join(" · ")}
                  </p>
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
