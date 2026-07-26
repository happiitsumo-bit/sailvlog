"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { Annotation, SessionDetail } from "@/types";
import { ReplayClock, computeProjection, renderFrame, BOAT_COLORS, RenderTrack, LocalProjection } from "@/lib/replay";
import { computeSwipeSeekStepSec, clampSeekTarget } from "@/lib/replay/touchSeek";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const TAIL_SECONDS = 300; // 直近5分（SPIKE-01実測構成を踏襲）
const UI_SYNC_INTERVAL_MS = 100; // UIパネルへの同期は≦10Hz（ARCH.md §4）
const SPEEDS = [1, 4, 8];
const ANNOTATION_KINDS = {
  question: { label: "問い", prefix: "問い" },
  insight: { label: "気づき", prefix: "気づき" },
  action: { label: "次回試す", prefix: "次回試す" },
} as const;
type AnnotationKind = keyof typeof ANNOTATION_KINDS;
type Leg = { label: string; startSec: number };

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
  const [comparisonTrackIds, setComparisonTrackIds] = useState<Set<number>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [simTimeDisplay, setSimTimeDisplay] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [newAnnotationBody, setNewAnnotationBody] = useState("");
  const [newAnnotationKind, setNewAnnotationKind] = useState<AnnotationKind>("insight");
  const [newAnnotationTrackId, setNewAnnotationTrackId] = useState<number | "">("");
  const [addingAnnotation, setAddingAnnotation] = useState(false);
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [comparisonMessage, setComparisonMessage] = useState("");
  const [legs, setLegs] = useState<Leg[]>([]);
  const [savingLegs, setSavingLegs] = useState(false);
  const [legError, setLegError] = useState<string | null>(null);
  // UI-DESIGN §4.6: スマホ縦画面では「比較する2艇」「反省メモ」を折りたたみアコーディオン（初期は閉）にする。
  // デスクトップでは常時展開のまま（レイアウト上ズレないよう、マウント時のみ幅判定して閉じる。SSRは開いた状態）。
  const [compareOpen, setCompareOpen] = useState(true);
  const [memoOpen, setMemoOpen] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<ReplayClock | null>(null);
  const projRef = useRef<LocalProjection | null>(null);
  const visibleTrackIdsRef = useRef<Set<number>>(new Set());
  const comparisonTrackIdsRef = useRef<Set<number>>(new Set());
  const touchStartXRef = useRef<number | null>(null);
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
        setLegs(
          d.session.legs?.length
            ? [...d.session.legs].sort((a, b) => a.startSec - b.startSec)
            : [{ label: "L1", startSec: 0 }]
        );

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
    // マウント時の1回だけ判定（リサイズは追従しない。回転等の再判定はスコープ外）。
    if (window.matchMedia("(max-width: 860px)").matches) {
      setCompareOpen(false);
      setMemoOpen(false);
    }
  }, []);

  useEffect(() => {
    visibleTrackIdsRef.current = visibleTrackIds;
  }, [visibleTrackIds]);

  useEffect(() => {
    comparisonTrackIdsRef.current = comparisonTrackIds;
  }, [comparisonTrackIds]);

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
        comparisonTrackIds: comparisonTrackIdsRef.current,
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
      setShareError(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard APIが使えない環境（非HTTPS等）では、ブロッキングダイアログではなく
      // 画面内にURLを表示して手動コピーさせる（UI-DESIGN §7-6: alert()/prompt()は使わない）。
      setShareError(window.location.href);
    }
  }

  /** Canvas上の左右スワイプで±5秒シーク（UI-DESIGN §4.6: 片手操作前提のタッチ操作）。
      タイムラインバーの直接ドラッグとは独立した経路で、シークバーの値は変えず
      seekAndSync経由でclockとURLを直接更新する。 */
  function handleCanvasTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  }
  function handleCanvasTouchEnd(e: React.TouchEvent<HTMLCanvasElement>) {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) return;
    const dx = endX - startX;
    const step = computeSwipeSeekStepSec(dx);
    if (step === 0) return;
    const clock = clockRef.current;
    const max = detail?.session.durationSec ?? 0;
    if (!clock || max === 0) return;
    seekAndSync(clampSeekTarget(clock.simTimeSec, step, max));
  }

  /** シークバーのキーボード操作（UI-DESIGN §7-3: ←→で±5秒、Shift併用で±30秒） */
  function handleSeekKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault(); // input[type=range]既定の±1秒を止めて仕様のステップに置き換える
    const clock = clockRef.current;
    if (!clock) return;
    const step = (e.shiftKey ? 30 : 5) * (e.key === "ArrowRight" ? 1 : -1);
    const max = detail?.session.durationSec ?? 0;
    seekAndSync(Math.min(Math.max(0, clock.simTimeSec + step), max));
  }

  async function addAnnotation() {
    if (!newAnnotationBody.trim() || !clockRef.current) return;
    setAddingAnnotation(true);
    setAnnotationError(null);
    try {
      const annotationKind = ANNOTATION_KINDS[newAnnotationKind];
      const currentLegIndex = legs.reduce(
        (found, leg, index) => (leg.startSec <= clockRef.current!.simTimeSec ? index : found),
        0
      );
      const { annotation } = await api.post<{ annotation: Annotation }>(`/api/sessions/${sessionId}/annotations`, {
        tSec: Math.floor(clockRef.current.simTimeSec),
        body: `【${annotationKind.prefix}】${newAnnotationBody.trim()}`,
        trackId: newAnnotationTrackId === "" ? undefined : newAnnotationTrackId,
        legIndex: currentLegIndex,
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

  function toggleComparison(trackId: number) {
    setComparisonTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
        setComparisonMessage("");
        return next;
      }
      if (next.size >= 2) {
        setComparisonMessage("比較できるのは2艇までです。いずれかを解除してください。");
        return next;
      }
      next.add(trackId);
      setComparisonMessage(next.size === 2 ? "2艇を強調表示しています。" : "もう1艇選ぶと比較表示になります。");
      return next;
    });
  }

  async function addLegBoundary() {
    const clock = clockRef.current;
    if (!clock) return;
    const startSec = Math.floor(clock.simTimeSec);
    if (startSec <= 0) {
      setLegError("タイムラインを進めてから、次のレグ開始位置を追加してください。");
      return;
    }
    if (legs.some((leg) => Math.abs(leg.startSec - startSec) < 2)) {
      setLegError("同じ時刻付近にレグ境界がすでにあります。");
      return;
    }

    const nextLegs = [...legs, { label: "", startSec }]
      .sort((a, b) => a.startSec - b.startSec)
      .map((leg, index) => ({ ...leg, label: `L${index + 1}` }));

    setSavingLegs(true);
    setLegError(null);
    try {
      const { session: updated } = await api.patch<{ session: SessionDetail["session"] }>(
        `/api/sessions/${sessionId}`,
        { legs: nextLegs }
      );
      setLegs(nextLegs);
      setDetail((prev) => (prev ? { ...prev, session: { ...prev.session, ...updated } } : prev));
    } catch (err) {
      setLegError(err instanceof Error ? err.message : "レグ境界の保存に失敗しました");
    } finally {
      setSavingLegs(false);
    }
  }

  if (loadError) {
    // 非TeamMember等の403もここに到達する（api.tsが本文のerrorメッセージ付きでthrowする。ARCH.md §4）。
    return (
      <div className="container">
        <div className="empty-state" role="alert">
          <div className="empty-state-icon" aria-hidden>×</div>
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
        <p role="status" style={{ color: "var(--fg-mute)" }}>読み込み中…</p>
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

      {/* UI-DESIGN §4.6: モバイルではDOM順が正（Canvas→再生コントロール→タイムライン→レグ→比較→メモ）。
          このdivの子はcanvas〜legsまでをまとめた.replay-mainと、比較・メモをまとめた.replay-asideの
          2要素のみで、DOM順どおり.replay-mainが先・.replay-asideが後（§7項目2、2026-07-25修正）。
          .replay-layoutは狭幅で縦積みになり、その際もDOM順=表示順になる（横並びのデスクトップでは
          .replay-asideが右カラムに回る）。 */}
      <div className="replay-layout">
        <div className="replay-main">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onTouchStart={handleCanvasTouchStart}
            onTouchEnd={handleCanvasTouchEnd}
            style={{ width: "100%", height: "auto", backgroundImage: "var(--gradient-water-deep)", border: "1px solid var(--border)", borderRadius: 8, display: "block", touchAction: "pan-y" }}
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

          {/* 状態通知（UI-DESIGN §7-6）。コピー完了は role="status"、コピー失敗は assertive で読み上げる */}
          <p role="status" className="sr-only">
            {copied ? "共有URLをクリップボードにコピーしました" : ""}
          </p>
          {shareError && (
            <p
              role="alert"
              style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--fg-mute)", wordBreak: "break-all" }}
            >
              クリップボードが使えませんでした。このURLを手動でコピーしてください: {shareError}
            </p>
          )}

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
              onKeyDown={handleSeekKeyDown}
              style={{ width: "100%", display: "block" }}
              aria-label="シークバー（左右キーで±5秒、Shift併用で±30秒）"
              aria-valuetext={`${formatTime(simTimeDisplay)} / ${formatTime(session.durationSec)}`}
            />
            {/* タイムライン注釈ピン（T-15）。クリックでその時刻へシークする。
                見た目は8pxだが、UI-DESIGN §7-7（WCAG 2.2 Target Size）に合わせて
                透明のヒット領域で24×24pxを確保する。 */}
            <div style={{ position: "relative", height: 24, marginTop: 2 }}>
              {annotations.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => seekAndSync(a.tSec)}
                  title={`${formatTime(a.tSec)} — ${a.body}`}
                  aria-label={`${formatTime(a.tSec)} の注釈へ移動: ${a.body}`}
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
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--terra)",
                      border: "1px solid var(--paper)",
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          <section
            aria-labelledby="legs-title"
            style={{ marginTop: "0.8rem", padding: "0.8rem 1rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
          >
            <div className="replay-legs-row" style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <h3 id="legs-title" className="sidebar-title" style={{ margin: 0, marginRight: "0.25rem", flexShrink: 0 }}>レグ</h3>
              {legs.map((leg) => (
                <button
                  key={`${leg.label}-${leg.startSec}`}
                  type="button"
                  className="filter-chip"
                  onClick={() => seekAndSync(leg.startSec)}
                  aria-label={`${leg.label}の開始 ${formatTime(leg.startSec)} へ移動`}
                >
                  {leg.label} · {formatTime(leg.startSec)}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-ghost replay-leg-add-btn"
                onClick={addLegBoundary}
                disabled={savingLegs}
                style={{ marginLeft: "auto", flexShrink: 0 }}
              >
                {savingLegs ? "保存中…" : "現在位置を次のレグ開始にする"}
              </button>
            </div>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "var(--fg-mute)" }}>
              タイムラインでマーク回航時刻へ移動して境界を保存すると、以後はレグボタンから頭出しできます。
            </p>
            {legError && <p role="alert" style={{ margin: "0.4rem 0 0", color: "var(--terra)", fontSize: "0.8rem" }}>{legError}</p>}
          </section>

        </div>

        <aside className="replay-aside">
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

          {/* UI-DESIGN §4.6: スマホ縦画面ではこの2パネル（比較する2艇／反省メモ）が
              折りたたみアコーディオン（初期は閉）に変形する。デスクトップは常時展開のまま
              動作を変えない（<details>のopen属性はデスクトップでも有効だが、マウント時の
              幅判定でスマホのみ閉じるためデスクトップの見た目・操作感は従来どおり）。 */}
          <details
            className="replay-accordion"
            open={compareOpen}
            onToggle={(e) => setCompareOpen(e.currentTarget.open)}
          >
            <summary className="sidebar-title" style={{ marginBottom: "0.4rem", cursor: "pointer" }}>
              比較する2艇（{comparisonTrackIds.size}/2）
            </summary>
            <p style={{ fontSize: "0.75rem", color: "var(--fg-mute)", margin: "0 0 0.65rem" }}>
              2艇を選ぶと、他艇を減光します。
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.5rem" }}>
              {tracks.map((t, i) => (
                <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={comparisonTrackIds.has(t.id)} onChange={() => toggleComparison(t.id)} />
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: BOAT_COLORS[i % BOAT_COLORS.length], display: "inline-block", flexShrink: 0 }} />
                  <span>{t.boatLabel}</span>
                </label>
              ))}
            </div>
            <p role="status" style={{ minHeight: "1.2rem", margin: "0 0 1.25rem", fontSize: "0.75rem", color: "var(--fg-mute)" }}>
              {comparisonMessage}
            </p>
          </details>

          <details
            className="replay-accordion"
            open={memoOpen}
            onToggle={(e) => setMemoOpen(e.currentTarget.open)}
          >
            <summary className="sidebar-title" style={{ marginBottom: "0.75rem", cursor: "pointer" }}>
              反省メモ（{annotations.length}）
            </summary>
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

            {/* 「今の場面にメモを残す」（UI-DESIGN §4.2「反省メモ」パネル＝一覧の下に追加導線）。
                §7項目2のDOM順修正で、艇の表示切替→比較→メモの並びに揃えるため
                main列からこちら（aside＝メモパネル内）へ移設した（2026-07-25）。 */}
            <div style={{ marginTop: "1.25rem", padding: "1rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}>
              <h3 className="sidebar-title" style={{ marginBottom: "0.6rem" }}>現在時刻({formatTime(simTimeDisplay)})に議論を残す</h3>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <select
                  aria-label="メモの種類"
                  value={newAnnotationKind}
                  onChange={(e) => setNewAnnotationKind(e.target.value as AnnotationKind)}
                  style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.5rem 0.6rem", color: "var(--fg)" }}
                >
                  {Object.entries(ANNOTATION_KINDS).map(([value, kind]) => (
                    <option key={value} value={value}>{kind.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newAnnotationBody}
                  onChange={(e) => setNewAnnotationBody(e.target.value)}
                  placeholder={newAnnotationKind === "action" ? "例: 次回は上マーク300m前で左右を確認する" : "例: ここでタック判断が遅れた"}
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
              {annotationError && (
                <p role="alert" style={{ color: "var(--terra)", fontSize: "0.8rem", marginTop: "0.4rem" }}>
                  {annotationError}
                </p>
              )}
              <p role="status" className="sr-only">
                {addingAnnotation ? "注釈を追加しています" : ""}
              </p>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
