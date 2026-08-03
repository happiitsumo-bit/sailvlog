"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { slugifyTeamName, isValidTeamSlug } from "@/lib/teamOnboarding";
import { TeamSummary } from "@/types";

type Mode = "create" | "join";

export default function TeamsPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");

  useEffect(() => {
    if (!isLoggedIn()) router.push("/login");
  }, [router]);

  return (
    <div className="form-page" style={{ maxWidth: 520 }}>
      <h1 className="form-title">⛵ チームに参加する</h1>
      <p style={{ marginTop: "-1.4rem", marginBottom: "1.6rem", fontSize: "0.85rem", color: "var(--fg-mute)" }}>
        練習・レースの記録を共有するには、まずチームが必要です。
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.8rem" }}>
        <button
          type="button"
          className={mode === "create" ? "btn btn-primary" : "btn btn-ghost"}
          style={{ flex: 1 }}
          onClick={() => setMode("create")}
        >
          チームを作る
        </button>
        <button
          type="button"
          className={mode === "join" ? "btn btn-primary" : "btn btn-ghost"}
          style={{ flex: 1 }}
          onClick={() => setMode("join")}
        >
          招待コードで参加する
        </button>
      </div>

      {mode === "create" ? <CreateTeamForm /> : <JoinTeamForm />}
    </div>
  );
}

function CreateTeamForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ team: TeamSummary; inviteCode: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugifyTeamName(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("チーム名を入力してください");
      return;
    }
    if (!isValidTeamSlug(slug)) {
      setError("slugは半角英小文字・数字・ハイフンで3文字以上にしてください");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ team: TeamSummary; inviteCode: string }>("/api/teams", {
        name: name.trim(),
        slug,
      });
      setCreated(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "チームの作成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function copyInviteCode() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFallback(created.inviteCode);
    }
  }

  if (created) {
    return (
      <div>
        <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
          「{created.team.name}」を作成しました。招待コードを部員に共有してください。
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.9rem 1rem",
            background: "var(--paper)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            marginBottom: "1rem",
          }}
        >
          <code style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", letterSpacing: "0.05em" }}>
            {created.inviteCode}
          </code>
          <button type="button" className="btn btn-ghost" onClick={copyInviteCode}>
            {copied ? "コピーしました" : "コピー"}
          </button>
        </div>
        {copyFallback && (
          <p className="form-error" role="alert">
            クリップボードにコピーできませんでした。この招待コードを手動でコピーしてください: {copyFallback}
          </p>
        )}
        <button type="button" className="btn btn-primary form-submit" onClick={() => router.push("/sessions/new")}>
          続けてGPXを取り込む →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="team-name">チーム名</label>
        <input
          id="team-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="例: ○○大学ヨット部"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="team-slug">slug（URLに使われます）</label>
        <input
          id="team-slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="例: xx-univ-sailing"
          required
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary form-submit" disabled={loading}>
        {loading ? "作成中..." : "チームを作成"}
      </button>
    </form>
  );
}

function JoinTeamForm() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!inviteCode.trim()) {
      setError("招待コードを入力してください");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ team: TeamSummary }>("/api/teams/join", { inviteCode: inviteCode.trim() });
      router.push(`/sessions?teamId=${res.team.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "参加に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="invite-code">招待コード</label>
        <input
          id="invite-code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="チームの管理者から共有されたコード"
          required
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary form-submit" disabled={loading}>
        {loading ? "参加中..." : "参加する"}
      </button>
    </form>
  );
}
