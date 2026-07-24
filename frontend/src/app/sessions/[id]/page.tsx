"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { Annotation, SessionDetail } from "@/types";
import { ReplayClock, computeProjection, renderFrame, BOAT_COLORS, RenderTrack, LocalProjection } from "@/lib/replay";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const TAIL_SECONDS = 300; // 直近5分（SPIKE-01実測構成を踏襲）
const UI_SYNC_INTERVAL_MS = 100; // UIパネルへの同期は≦10Hz（ARCH.md §4）
const SPEEDS = [1, 4, 8];

function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

export default function SessionReplayPage() {
  return (
    <Suspense fallback={null}>
      <SessionReplayPageContent />
    </Suspense>
  );
}

function SessionReplayPageContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const sessionId = params.id;

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleTrackIds, setVisibleTrackIds] = useState<Set<number>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [simTimeDisplay, setSimTimeDisplay] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [newAnnotationBody, setNewAnnotationBody] = useState("");
  const [newAnnotationTrackId, setNewAnnotationTrackId] = useState<number | "">("");
  const [addingAnnotation, setAddingAnnotation] = useState(false);
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<ReplayClock | null>(null);
  const projRef = useRef<LocalProjection | null>(null);
  const visibleTrackIdsRef = useRef<Set<number>>(new Set());
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/login"); return; }
    api
      .get<SessionDetail>(`/api/sessions/${sessionId}`)
      .then((d) => {
        setDetail(d);
        setAnnotations(d.annotations);

        // 部内共有URL(?t=&boats=)の読み込み（T-16, ARCH.md §4）。値が無い/不正なら全艇表示・t=0にフォールバック。
        const trackIds = d.tracks.map((t) => t.id);
        const boatsParam = searchParams.get("boats");
        const boatsFromUrl = boatsParam
          ? boatsParam.split(",").map(Number).filter((id) => trackIds.includes(id))
          : [];
        setVisibleTrackIds(new Set(boatsFromUrl.length > 0 ? boatsFromUrl : trackIds));

        const clock = new ReplayClock(d.session.durationSec);
        const tParam = Number(searchParams.get("t"));
        if (Number.isFinite(tParam) && tParam > 0) {
          clock.seekTo(tParam);
          setSimTimeDisplay(clock.simTimeSec);
        }
        clockRef.current = clock;
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "セッションの取得に失敗しました"));
  }, [sessionId, router]);

  useEffect(() => {
    visibleTrackIdsRef.current = visibleTrackIds;
  }, [visibleTrackIds]);

  useEffect(() => {
    clockRef.current?.setSpeed(speed);
  }, [speed]);

  const renderTracks: RenderTrack[] = useMemo(
    () => detail?.tracks.map((t) => ({ id: t.id, boatLabel: t.boatLabel, startSec: t.startSec, pointCount: t.pointCount, gridJson: t.gridJson })) ?? [],
    [detail]
  );

  // rAF+ref 再生ループ（ARCH.md §4 ADR-001）。React stateはUIパネル同期用に≦10Hzでのみ更新する。
  useEffect(() => {
    if (renderTracks.length === 0 || !clockRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    projRef.current = computeProjection(renderTracks, canvas.width, canvas.height);
    lastFrameTimeRef.current = null;

    function loop(now: number) {
      const clock = clockRef.current;
      const proj = projRef.current;
      if (!clock || !proj || !canvas || !ctx) return;

      if (lastFrameTimeRef.current !== null) {
        clock.tick(now - lastFrameTimeRef.current);
      }
      lastFrameTimeRef.current = now;

      renderFrame(ctx, canvas, {
        tracks: renderTracks,
        proj,
        simTimeSec: clock.simTimeSec,
        visibleTrackIds: visibleTrackIdsRef.current,
        tailSeconds: TAIL_SECONDS,
      });

      if (now - lastSyncTimeRef.current >= UI_SYNC_INTERVAL_MS) {
        lastSyncTimeRef.current = now;
        setSimTimeDisplay(clock.simTimeSec);
        setPlaying(clock.playing);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [renderTracks]);

  // 部内共有URL(?t=&boats=)の書き込み（T-16）。一時停止/シーク確定時のみ history.replaceState する
  // （再生中は毎フレーム書き換えない。ARCH.md §4）。
  function syncUrl(tSec: number, boatIds: Set<number>) {
    const url = new URL(window.location.href);
    url.searchParams.set("t", String(Math.floor(tSec)));
    if (boatIds.size > 0) url.searchParams.set("boats", [...boatIds].join(","));
    else url.searchParams.delete("boats");
    window.history.replaceState(null, "", url);
  }

  function togglePlay() {
    const clock = clockRef.current;
    if (!clock) return;
    if (clock.playing) {
      clock.pause();
      syncUrl(clock.simTimeSec, visibleTrackIdsRef.current);
    } else {
      clock.play();
    }
    setPlaying(clock.playing);
  }

  function handleSeek(sec: number) {
    clockRef.current?.seekTo(sec);
    setSimTimeDisplay(sec);
  }

  /** シークバーのドラッグ/クリック確定時（mouseup/touchend）に呼ぶ。ARCH.md §4「シーク確定時のみ」 */
  function handleSeekCommit() {
    if (!clockRef.current) return;
    syncUrl(clockRef.current.simTimeSec, visibleTrackIdsRef.current);
  }

  /** ピン/注釈一覧クリックのように一発で確定するシーク */
  function seekAndSync(sec: number) {
    handleSeek(sec);
    syncUrl(sec, visibleTrackIdsRef.current);
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard APIが使えない環境ではボタン自体を無効化していないため、フォールバックのアラートで代替
      window.prompt("このURLをコピーしてください:", window.location.href);
    }
  }

  async function addAnnotation() {
    if (!newAnnotationBody.trim() || !clockRef.current) return;
    setAddingAnnotation(true);
    setAnnotationError(null);
    try {
      const { annotation } = await api.post<{ annotation: Annotation }>(`/api/sessions/${sessionId}/annotations`, {
        tSec: Math.floor(clockRef.current.simTimeSec),
        body: newAnnotationBody.trim(),
        trackId: newAnnotationTrackId === "" ? undefined : newAnnotationTrackId,
      });
      setAnnotations((prev) => [...prev, annotation].sort((a, b) => a.tSec - b.tSec));
      setNewAnnotationBody("");
      setNewAnnotationTrackId("");
    } catch (err) {
      setAnnotationError(err instanceof Error ? err.message : "注釈の追加に失敗しました");
    } finally {
      setAddingAnnotation(false);
    }
  }

  function toggleBoat(trackId: number) {
    setVisibleTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }

  if (loadError) {
    // 非TeamMember等の403もここに到達する（api.tsが本文のerrorメッセージ付きでthrowする。ARCH.md §4）。
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">×</div>
          <p className="empty-state-text">閲覧できません</p>
          <p style={{ color: "var(--fg-mute)", fontSize: "0.85rem", marginTop: "0.5rem" }}>{loadError}</p>
        </div>
        <div style={{ textAlign: "center" }}>
          <Link href="/sessions" className="btn btn-ghost">Sessionsへ戻る</Link>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="container">
        <p style={{ color: "var(--fg-mute)" }}>読み込み中…</p>
      </div>
    );
  }

  const { session, tracks } = detail;

  return (
    <div className="container" style={{ maxWidth: 1080 }}>
      <div className="page-header">
        <Link href="/sessions" className="page-header-back">Sessions</Link>
        <h1 className="page-header-title">{session.title}</h1>
        <p className="page-header-sub">
          {session.type === "race" ? "レース" : "練習"} · {new Date(session.startedAt).toLocaleString("ja-JP")}
          {session.venue ? ` · ${session.venue}` : ""}
        </p>
      </div>

      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 600px", minWidth: 300 }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{ width: "100%", height: "auto", background: "#eef3f5", border: "1px solid var(--border)", borderRadius: 8, display: "block" }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.85rem", flexWrap: "wrap" }}>
            <button type="button" onClick={togglePlay} className="btn btn-primary" style={{ minWidth: 88 }}>
              {playing ? "一時停止" : "再生"}
            </button>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={speed === s ? "filter-chip active" : "filter-chip"}
              >
                {s}x
              </button>
            ))}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--fg-mute)" }}>
              {formatTime(simTimeDisplay)} / {formatTime(session.durationSec)}
            </span>
            <button type="button" onClick={copyShareUrl} className="btn btn-ghost" style={{ marginLeft: "auto" }}>
              {copied ? "URLをコピーしました" : "共有URLをコピー"}
            </button>
          </div>

          <div style={{ position: "relative", marginTop: "0.6rem" }}>
            <input
              type="range"
              min={0}
              max={session.durationSec}
              step={1}
              value={Math.floor(simTimeDisplay)}
              onChange={(e) => handleSeek(Number(e.target.value))}
              onMouseUp={handleSeekCommit}
              onTouchEnd={handleSeekCommit}
              onKeyUp={handleSeekCommit}
              style={{ width: "100%", display: "block" }}
              aria-label="シークバー"
            />
            {/* タイムライン注釈ピン（T-15）。クリックでその時刻へシークする */}
            <div style={{ position: "relative", height: 14, marginTop: 2 }}>
              {annotations.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => seekAndSync(a.tSec)}
                  title={`${formatTime(a.tSec)} — ${a.body}`}
                  style={{
                    position: "absolute",
                    left: `${(a.tSec / session.durationSec) * 100}%`,
                    transform: "translateX(-50%)",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--terra)",
                    border: "1px solid var(--paper)",
                    padding: 0,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ marginTop: "1.25rem", padding: "1rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}>
            <h3 className="sidebar-title" style={{ marginBottom: "0.6rem" }}>現在時刻({formatTime(simTimeDisplay)})に注釈を追加</h3>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                value={newAnnotationBody}
                onChange={(e) => setNewAnnotationBody(e.target.value)}
                placeholder="例: ここでタック判断が遅れた"
                maxLength={2000}
                style={{ flex: "1 1 240px", background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.5rem 0.75rem", color: "var(--fg)" }}
              />
              <select
                value={newAnnotationTrackId}
                onChange={(e) => setNewAnnotationTrackId(e.target.value ? Number(e.target.value) : "")}
                style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.5rem 0.6rem", color: "var(--fg)" }}
              >
                <option value="">対象艇（任意）</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>{t.boatLabel}</option>
                ))}
              </select>
              <button type="button" onClick={addAnnotation} className="btn btn-primary" disabled={!newAnnotationBody.trim() || addingAnnotation}>
                {addingAnnotation ? "追加中…" : "追加"}
              </button>
            </div>
            {annotationError && <p style={{ color: "var(--terra)", fontSize: "0.8rem", marginTop: "0.4rem" }}>{annotationError}</p>}
          </div>
        </div>

        <aside style={{ flex: "0 0 240px", minWidth: 200 }}>
          <h3 className="sidebar-title" style={{ marginBottom: "0.75rem" }}>艇の表示</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
            {tracks.map((t, i) => (
              <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
                <input type="checkbox" checked={visibleTrackIds.has(t.id)} onChange={() => toggleBoat(t.id)} />
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: BOAT_COLORS[i % BOAT_COLORS.length], display: "inline-block", flexShrink: 0 }} />
                <span>{t.boatLabel}</span>
              </label>
            ))}
          </div>

          <h3 className="sidebar-title" style={{ marginBottom: "0.75rem" }}>注釈（{annotations.length}）</h3>
          {annotations.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--fg-mute)" }}>まだ注釈がありません</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {annotations.map((a) => {
                const track = tracks.find((t) => t.id === a.trackId);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => seekAndSync(a.tSec)}
                    style={{
                      textAlign: "left",
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "0.5rem 0.65rem",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--fg-mute)" }}>
                      {formatTime(a.tSec)}{track ? ` · ${track.boatLabel}` : ""}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--fg)" }}>{a.body}</div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
