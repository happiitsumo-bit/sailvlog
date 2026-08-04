"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { parseGpx, normalizeToGrid, computeSessionStart, GpxParseError, GpxPoint } from "@/lib/gpx";
import { describeOversizedPayload } from "@/lib/importPayload";
import { SessionType, TeamSummary } from "@/types";
import SessionPreviewCanvas from "./SessionPreviewCanvas";

const MAX_DURATION_SEC = 14400; // 4時間（ARCH.md §3・backendと同じ上限）

interface TrackDraft {
  fileName: string;
  boatLabel: string;
  points: GpxPoint[];
  rawGpx: string;
  error?: string;
}

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<SessionType>("practice");
  const [venue, setVenue] = useState("");
  const [teamId, setTeamId] = useState<number | "">("");
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [tracks, setTracks] = useState<TrackDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    api.get<{ teams: TeamSummary[] }>("/api/teams").then((r) => setTeams(r.teams)).catch(() => {});
  }, [router]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setSubmitError(null);

    const drafts: TrackDraft[] = await Promise.all(
      Array.from(fileList).map(async (file) => {
        const boatLabel = file.name.replace(/\.gpx$/i, "");
        try {
          const rawGpx = await file.text();
          const points = parseGpx(rawGpx);
          return { fileName: file.name, boatLabel, points, rawGpx };
        } catch (err) {
          return {
            fileName: file.name,
            boatLabel,
            points: [],
            rawGpx: "",
            error: err instanceof GpxParseError ? err.message : "GPXの読み込みに失敗しました",
          };
        }
      })
    );

    setTracks(drafts);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ドロップゾーン（UI-DESIGN §3・§7項目4）。実<input type="file">＋<label for>は既存のままa11yを維持し、
  // その上にドラッグ&ドロップの受け口を重ねるだけ（キーボードのみのユーザーはlabelクリック/Tab+Enterで
  // 従来どおり操作できる）。dragenter/dragleaveは子要素への出入りで交互に発火するため、
  // dragOver側で毎回trueに倒し、実際にドロップゾーン外へ出たときだけdragLeaveでfalseにする。
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingOver(true);
  }
  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDraggingOver(false);
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function updateBoatLabel(index: number, label: string) {
    setTracks((prev) => prev.map((t, i) => (i === index ? { ...t, boatLabel: label } : t)));
  }

  function removeTrack(index: number) {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  }

  const hasErrors = tracks.some((t) => t.error);
  const validTracks = useMemo(() => tracks.filter((t) => !t.error), [tracks]);

  // セッション基準時刻(t=0)と各艇のグリッド正規化（ARCH.md §3・lib/gpx T-11）
  const normalized = useMemo(() => {
    if (validTracks.length === 0 || hasErrors) return null;
    try {
      const sessionStartMs = computeSessionStart(validTracks.map((t) => t.points));
      const grids = validTracks.map((t) => ({
        boatLabel: t.boatLabel,
        rawGpx: t.rawGpx,
        ...normalizeToGrid(t.points, sessionStartMs),
      }));
      const durationSec = Math.max(...grids.map((g) => g.startSec + g.pointCount));
      return { sessionStartMs, grids, durationSec };
    } catch {
      return null;
    }
  }, [validTracks, hasErrors]);

  const durationTooLong = !!normalized && normalized.durationSec > MAX_DURATION_SEC;

  const canSubmit =
    title.trim().length > 0 &&
    teamId !== "" &&
    !hasErrors &&
    !!normalized &&
    normalized.grids.length > 0 &&
    !durationTooLong &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !normalized) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      // セッション作成とトラック投入を1リクエストにまとめる（Issue #40）。
      // 以前は艇ごとにPOSTをループしていたため、途中の1本が失敗すると
      // セッションと先行トラックだけがDBに残った。バックエンド側で
      // 1トランザクションにしたため、失敗時はセッションごと作られない。
      const payload = {
        title: title.trim(),
        type,
        startedAt: new Date(normalized.sessionStartMs).toISOString(),
        durationSec: normalized.durationSec,
        teamId,
        venue: venue.trim() || undefined,
        tracks: normalized.grids.map((g) => ({
          boatLabel: g.boatLabel,
          startSec: g.startSec,
          pointCount: g.pointCount,
          gridJson: g.gridJson,
          rawGpx: g.rawGpx,
        })),
      };

      // 1リクエストに統合した副作用として、全艇の合計サイズがサーバのbody上限に当たりうる。
      // 上限を超えると express が本文をパースする前に413を返し、アプリのエラー処理も通らないため
      // 「保存に失敗しました」としか出せない。何が起きたかを言えるよう手前で判定する。
      const tooLarge = describeOversizedPayload(payload);
      if (tooLarge) {
        setSubmitError(tooLarge);
        return;
      }

      await api.post<{ session: { id: number } }>("/api/sessions", payload);

      router.push(`/sessions?teamId=${teamId}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "保存に失敗しました。ログインしているか確認してください。"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <Link href="/sessions" className="page-header-back">Sessions</Link>
        <h1 className="page-header-title">セッション取込</h1>
        <p className="page-header-sub">GPXファイル（艇ごとに1本）を選択すると、共通の1Hzグリッドへ正規化してプレビューします。</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <label htmlFor="s-title" style={fieldLabelStyle}>TITLE *</label>
          <input
            id="s-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 7/24 午後練習"
            required
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <label htmlFor="s-type" style={fieldLabelStyle}>TYPE</label>
            <select id="s-type" value={type} onChange={(e) => setType(e.target.value as SessionType)} style={selectStyle}>
              <option value="practice">練習</option>
              <option value="race">レース</option>
            </select>
          </div>
          <div>
            <label htmlFor="s-team" style={fieldLabelStyle}>TEAM *</label>
            <select
              id="s-team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value ? Number(e.target.value) : "")}
              required
              style={selectStyle}
            >
              <option value="">チームを選択</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="s-venue" style={fieldLabelStyle}>VENUE</label>
            <input id="s-venue" type="text" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="任意" style={{ ...inputStyle, width: 200 }} />
          </div>
        </div>

        <div>
          <label htmlFor="s-gpx" style={fieldLabelStyle}>GPX FILES（艇ごとに1本・複数選択可）*</label>
          {/* ドロップゾーン（UI-DESIGN §3）。実<input type="file">＋<label for>はそのまま維持し
              （キーボードのみのユーザーはこれで操作できる）、その上にドラッグ&ドロップの受け口を重ねる。
              スマホ等タッチ環境はドラッグ操作自体が無いため、この装飾は無害（§4.6のとおりボタン操作のみで完結する）。 */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              marginTop: "0.25rem",
              border: `2px dashed ${isDraggingOver ? "var(--color-accent)" : "var(--border)"}`,
              borderRadius: 10,
              padding: "1.1rem 1rem",
              textAlign: "center",
              background: isDraggingOver ? "var(--color-accent-tint)" : "transparent",
              transition: "border-color 0.15s var(--ease-out), background 0.15s var(--ease-out)",
            }}
          >
            {/* UI-DESIGN §4.6: スマホはDnD非対応のタッチ環境が前提のため、ヒント文言のみ非表示にする
                （「ファイルを選択」ボタンは残す。§7項目4のドロップゾーン自体はデスクトップ専用の装飾）。 */}
            <p className="gpx-dropzone-hint" style={{ fontSize: "0.85rem", color: "var(--fg-mute)", marginBottom: "0.6rem" }}>
              ここにGPXをドラッグ&ドロップ
            </p>
            <label htmlFor="s-gpx" className="btn btn-ghost" style={{ display: "inline-block", cursor: "pointer" }}>
              ファイルを選択
            </label>
            <input
              id="s-gpx"
              ref={fileInputRef}
              type="file"
              accept=".gpx"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="sr-only"
            />
          </div>
        </div>

        {tracks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {tracks.map((t, i) => (
              <div
                key={`${t.fileName}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.6rem 0.85rem",
                  background: "var(--card)",
                  border: `1px solid ${t.error ? "var(--terra)" : "var(--border)"}`,
                  borderRadius: 8,
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--fg-mute)", minWidth: 0, flexShrink: 0 }}>
                  {t.fileName}
                </span>
                {t.error ? (
                  <span role="alert" style={{ color: "var(--terra)", fontSize: "0.85rem" }}>{t.error}</span>
                ) : (
                  <>
                    <input
                      type="text"
                      value={t.boatLabel}
                      onChange={(e) => updateBoatLabel(i, e.target.value)}
                      aria-label={`${t.fileName} の艇ラベル`}
                      style={{ ...inputStyle, padding: "0.4rem 0.6rem", flex: 1 }}
                    />
                    <span style={{ fontSize: "0.78rem", color: "var(--fg-mute)" }}>{t.points.length}pt</span>
                  </>
                )}
                <button type="button" onClick={() => removeTrack(i)} className="btn btn-ghost" style={{ padding: "0.3rem 0.7rem" }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {normalized && normalized.grids.length > 0 && (
          <div>
            <label style={fieldLabelStyle}>プレビュー（{normalized.grids.length}艇・{normalized.durationSec}秒）</label>
            <SessionPreviewCanvas tracks={normalized.grids} />
          </div>
        )}

        {/* エラー帯・状態通知は支援技術にも伝える（UI-DESIGN §7-6） */}
        {durationTooLong && (
          <p role="alert" style={{ color: "var(--terra)", fontSize: "0.85rem" }}>
            セッション長が{MAX_DURATION_SEC / 3600}時間の上限を超えています（{Math.round((normalized?.durationSec ?? 0) / 60)}分）。
          </p>
        )}

        {submitError && <p role="alert" style={{ color: "var(--terra)", fontSize: "0.85rem" }}>{submitError}</p>}

        <p role="status" className="sr-only">
          {submitting ? "セッションを保存しています" : ""}
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", paddingTop: "0.5rem" }}>
          <Link href="/sessions" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {submitting ? "保存中…" : "取り込む"}
          </button>
        </div>
      </form>
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: "0.75rem",
  color: "var(--fg-mute)",
  marginBottom: "0.5rem",
  letterSpacing: "0.1em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "0.85rem 1rem",
  color: "var(--fg)",
  fontSize: "1rem",
  fontFamily: "var(--font-body)",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "0.75rem 1rem",
  color: "var(--fg)",
  fontSize: "0.9rem",
  fontFamily: "var(--font-body)",
  minWidth: 160,
};
