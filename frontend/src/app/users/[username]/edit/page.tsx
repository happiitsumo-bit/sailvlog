"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { BoatType } from "@/types";

interface ProfileData {
  id: number;
  username: string;
  bio?: string;
  specialty?: string;
  affiliation?: string;
  experienceYears?: number;
  boatType?: BoatType;
}

export default function EditProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const router = useRouter();

  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [experienceYears, setExperienceYears] = useState<string>("");
  const [boatTypeId, setBoatTypeId] = useState<number | "">("");
  const [boatTypes, setBoatTypes] = useState<BoatType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // 未ログインユーザーは即座にリダイレクト
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    Promise.all([
      api.get<ProfileData>("/api/users/me"),
      api.get<BoatType[]>("/api/boat-types"),
    ])
      .then(([profile, bts]) => {
        // 自分のプロフィールページ以外はトップへリダイレクト
        if (profile.username !== username) {
          router.push(`/users/${username}`);
          return;
        }
        setBio(profile.bio ?? "");
        setSpecialty(profile.specialty ?? "");
        setAffiliation(profile.affiliation ?? "");
        setExperienceYears(profile.experienceYears?.toString() ?? "");
        setBoatTypeId(profile.boatType?.id ?? "");
        setBoatTypes(bts);
      })
      .catch(() => {
        alert("ログインが必要です");
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [router, username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put("/api/users/me", {
        bio,
        specialty,
        affiliation,
        experienceYears: experienceYears ? Number(experienceYears) : null,
        boatTypeId: boatTypeId || null,
      });
      router.push(`/users/${username}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="empty-state"><div className="empty-state-icon">○</div><p className="empty-state-text">Loading…</p></div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "0.85rem 1rem",
    color: "var(--fg)",
    fontSize: "0.95rem",
    fontFamily: "var(--font-body)",
    boxSizing: "border-box",
  };

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <Link href={`/users/${username}`} className="page-header-back">Profile</Link>
        <h1 className="page-header-title">Edit Profile</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--fg-mute)", marginBottom: "0.5rem", letterSpacing: "0.1em" }}>
            BIO
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="自己紹介・実績・セーリングスタイルなど"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--fg-mute)", marginBottom: "0.5rem", letterSpacing: "0.1em" }}>
            BOAT TYPE
          </label>
          <select
            value={boatTypeId}
            onChange={(e) => setBoatTypeId(e.target.value ? Number(e.target.value) : "")}
            style={{ ...inputStyle, minWidth: "unset" }}
          >
            <option value="">選択しない</option>
            {boatTypes.map((bt) => (
              <option key={bt.id} value={bt.id}>{bt.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--fg-mute)", marginBottom: "0.5rem", letterSpacing: "0.1em" }}>
              EXPERIENCE YEARS
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              placeholder="例: 5"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--fg-mute)", marginBottom: "0.5rem", letterSpacing: "0.1em" }}>
              AFFILIATION
            </label>
            <input
              type="text"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="例: Waseda Univ. SC"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--fg-mute)", marginBottom: "0.5rem", letterSpacing: "0.1em" }}>
            SPECIALTY
          </label>
          <input
            type="text"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="例: Sail trim / Tactics"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
          <Link href={`/users/${username}`} className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
