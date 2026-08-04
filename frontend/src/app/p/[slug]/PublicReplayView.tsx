"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ReplayClock, computeProjection, renderFrame, BOAT_COLORS, RenderTrack, LocalProjection, useCanvasViewport } from "@/lib/replay";
import { formatClockTime } from "@/lib/utils";
import { PublicSessionResponse } from "@/types";

// UI-DESIGN §5.3 公開ビュー。DOM順が仕様: 学びの要約→Canvas→再生コントロール→
// タイムライン(公開注釈のみ)→公開メモ一覧→「sailvlogとは」。
// **再生エンジン（lib/replay）はそのまま再利用し、描画コードを分岐も複製もしない（ADR-007）。**
// 編集系UI（メモ追加・公開ボタン・削除・比較チェック等）は一切描画しない。艇の表示切替と
// 再生操作だけは「読む体験に必要」なため残す。

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const TAIL_SECONDS = 300; // 部内版(T-14)と同じ直近5分
const UI_SYNC_INTERVAL_MS = 100; // ARCH.md §4: UIパネル同期は≦10Hz
const SPEEDS = [1, 4, 8];
const NO_COMPARISON = new Set<number>(); // 公開ビューに比較強調機能はない（常に空集合を渡す）

export function PublicReplayView({ data }: { data: PublicSessionResponse }) {
  const { session, tracks, annotations } = data;

  const [visibleTrackIds, setVisibleTrackIds] = useState<Set<number>>(() => new Set(tracks.map((t) => t.id)));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [simTimeDisplay, setSimTimeDisplay] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<ReplayClock | null>(null);
  const projRef = useRef<LocalProjection | null>(null);
  const visibleTrackIdsRef = useRef<Set<number>>(visibleTrackIds);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Issue #37: 部内版(/sessions/[id])と同じ実装をそのまま再利用する（ADR-007）。
  const {
    viewportRef,
    handleMouseDown: handleCanvasMouseDown,
    handleMouseMove: handleCanvasMouseMove,
    handleMouseUp: handleCanvasMouseUp,
    handleTouchStartPinch,
    handleTouchMovePinch,
    handleTouchEndPinch,
    reset: resetViewport,
  } = useCanvasViewport(canvasRef);

  useEffect(() => {
    clockRef.current = new ReplayClock(session.durationSec);
  }, [session.durationSec]);

  useEffect(() => {
    visibleTrackIdsRef.current = visibleTrackIds;
  }, [visibleTrackIds]);

  useEffect(() => {
    clockRef.current?.setSpeed(speed);
  }, [speed]);

  const renderTracks: RenderTrack[] = useMemo(
    () => tracks.map((t) => ({ id: t.id, boatLabel: t.boatLabel, startSec: t.startSec, pointCount: t.pointCount, gridJson: t.gridJson })),
    [tracks]
  );

  // rAF+ref 再生ループ（部内版 /sessions/[id] と同一のパターン。ARCH.md §4 ADR-001）。
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
        comparisonTrackIds: NO_COMPARISON,
        tailSeconds: TAIL_SECONDS,
        playing: clock.playing,
        viewport: viewportRef.current,
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

  function togglePlay() {
    const clock = clockRef.current;
    if (!clock) return;
    if (clock.playing) clock.pause();
    else clock.play();
    setPlaying(clock.playing);
  }

  function handleSeek(sec: number) {
    clockRef.current?.seekTo(sec);
    setSimTimeDisplay(sec);
  }

  function toggleBoat(trackId: number) {
    setVisibleTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }

  function handleSeekKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = (e.shiftKey ? 30 : 5) * (e.key === "ArrowRight" ? 1 : -1);
    handleSeek(Math.min(Math.max(0, simTimeDisplay + step), session.durationSec));
  }

  return (
    <div className="container" style={{ maxWidth: 1080 }}>
      <header className="public-view-header">
        <span className="public-view-brand">⛵ sailvlog</span>
        <a href="#public-about" className="public-view-about-link">これは何?</a>
      </header>

      <div className="page-header">
        <h1 className="page-header-title">{session.title}</h1>
        <p className="page-header-sub">
          {new Date(session.startedAt).toLocaleDateString("ja-JP")}
          {" ・ "}
          {session.team.name}
        </p>
      </div>

      {/* 学びの要約（DOM順1番目。UI-DESIGN §5.3「部外の人が最初に読む本文」） */}
      <section aria-labelledby="public-summary-title" className="public-summary-card">
        <h2 id="public-summary-title" className="sidebar-title">学びの要約</h2>
        <p className="public-summary-body">{session.learningSummary}</p>
      </section>

      {/* Canvas（DOM順2番目・常時ダーク海図面。部内版と同一） */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onTouchStart={handleTouchStartPinch}
        onTouchMove={handleTouchMovePinch}
        onTouchEnd={handleTouchEndPinch}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        style={{
          width: "100%",
          height: "auto",
          backgroundImage: "var(--gradient-water-deep)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          display: "block",
          marginTop: "1rem",
          touchAction: "pan-y",
          cursor: "grab",
        }}
      />

      {/* 再生コントロール（DOM順3番目）。艇の表示切替も「読む体験に必要」としてここに含める（UI-DESIGN §5.3）。 */}
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
          {formatClockTime(simTimeDisplay)} / {formatClockTime(session.durationSec)}
        </span>
        <button type="button" onClick={resetViewport} className="btn btn-ghost">
          表示をリセット
        </button>
      </div>

      {tracks.length > 1 && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.6rem" }} role="group" aria-label="艇の表示切替">
          {tracks.map((t, i) => (
            <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", minHeight: 24, cursor: "pointer" }}>
              <input type="checkbox" checked={visibleTrackIds.has(t.id)} onChange={() => toggleBoat(t.id)} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: BOAT_COLORS[i % BOAT_COLORS.length], display: "inline-block", flexShrink: 0 }} />
              {t.boatLabel}
            </label>
          ))}
        </div>
      )}

      {/* タイムライン（DOM順4番目・公開注釈のみピン。APIが既にisPublic=trueのみ返す＝serializePublicSession） */}
      <div style={{ position: "relative", marginTop: "0.6rem" }}>
        <input
          type="range"
          min={0}
          max={session.durationSec}
          step={1}
          value={Math.floor(simTimeDisplay)}
          onChange={(e) => handleSeek(Number(e.target.value))}
          onKeyDown={handleSeekKeyDown}
          style={{ width: "100%", display: "block" }}
          aria-label="シークバー（左右キーで±5秒、Shift併用で±30秒）"
          aria-valuetext={`${formatClockTime(simTimeDisplay)} / ${formatClockTime(session.durationSec)}`}
        />
        <div style={{ position: "relative", height: 24, marginTop: 2 }}>
          {annotations.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => handleSeek(a.tSec)}
              title={`${formatClockTime(a.tSec)} — ${a.body}`}
              aria-label={`${formatClockTime(a.tSec)} の注釈へ移動: ${a.body}`}
              style={{
                position: "absolute",
                left: `${(a.tSec / session.durationSec) * 100}%`,
                transform: "translateX(-50%)",
                width: 24,
                height: 24,
                display: "grid",
                placeItems: "center",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden
                style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--terra)", border: "1px solid var(--paper)" }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* 公開メモ一覧（DOM順5番目） */}
      <section aria-labelledby="public-notes-title" style={{ marginTop: "1.2rem" }}>
        <h2 id="public-notes-title" className="sidebar-title" style={{ marginBottom: "0.6rem" }}>公開されたメモ</h2>
        {annotations.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--fg-mute)" }}>公開されたメモはありません。</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {annotations.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleSeek(a.tSec)}
                style={{ textAlign: "left", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.5rem 0.65rem", cursor: "pointer" }}
              >
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--fg-mute)" }}>{formatClockTime(a.tSec)}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--fg)" }}>{a.body}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 「sailvlogとは」説明ブロック（DOM順6番目・最後） */}
      <section id="public-about" className="public-about-block">
        <h2 className="sidebar-title" style={{ marginBottom: "0.5rem" }}>sailvlogとは</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--fg-mute)", lineHeight: 1.7 }}>
          sailvlogは大学ヨット部の反省会ツールです。GPXログを取り込み、複数艇の航跡を同期再生しながら
          反省会での気づきをタイムラインに残せます。このページは、そのうち公開が選ばれた学びの要約と
          メモだけを、関係者以外にも読み取り専用で共有するためのものです。
        </p>
      </section>
    </div>
  );
}
