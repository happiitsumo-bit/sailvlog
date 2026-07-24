"use client";

import { useEffect, useRef } from "react";

interface PreviewTrack {
  boatLabel: string;
  gridJson: { lat: number[]; lon: number[] };
}

const BOAT_COLORS = ["#c1552c", "#2c6e8f", "#4a7c59", "#8a5fb0", "#c9a13b", "#b0475f"];

/**
 * 取込ウィザードの重ね描き簡易プレビュー（ARCH.md §4「Canvas静止画で可」）。
 * ローカル平面投影（緯度で経度を補正するだけの簡易版）で全艇を1枚に重ねる静止画。
 * 再生ページ本体のCanvasRenderer（T-14・lib/replay/）とは別実装。
 */
export default function SessionPreviewCanvas({ tracks }: { tracks: PreviewTrack[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = "#eef3f5";
    ctx.fillRect(0, 0, width, height);

    const allLat = tracks.flatMap((t) => t.gridJson.lat);
    const allLon = tracks.flatMap((t) => t.gridJson.lon);
    if (allLat.length === 0) return;

    const latMin = Math.min(...allLat);
    const latMax = Math.max(...allLat);
    const lonMin = Math.min(...allLon);
    const lonMax = Math.max(...allLon);
    const latMid = (latMin + latMax) / 2;
    const cosLat = Math.max(Math.cos((latMid * Math.PI) / 180), 0.01);

    // ローカル平面投影: 経度をcos(緯度)で補正し、緯度・経度を等スケールで描画
    const spanX = Math.max((lonMax - lonMin) * cosLat, 1e-6);
    const spanY = Math.max(latMax - latMin, 1e-6);
    const padding = 20;
    const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);

    function project(lat: number, lon: number): [number, number] {
      const x = padding + (lon - lonMin) * cosLat * scale;
      const y = height - padding - (lat - latMin) * scale; // 北が上になるようYを反転
      return [x, y];
    }

    tracks.forEach((track, i) => {
      const color = BOAT_COLORS[i % BOAT_COLORS.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      track.gridJson.lat.forEach((lat, idx) => {
        const lon = track.gridJson.lon[idx];
        const [x, y] = project(lat, lon);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 開始点マーカー
      const [sx, sy] = project(track.gridJson.lat[0], track.gridJson.lon[0]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [tracks]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        style={{ width: "100%", maxWidth: 640, height: "auto", border: "1px solid var(--border)", borderRadius: 8, display: "block" }}
      />
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
        {tracks.map((t, i) => (
          <span key={t.boatLabel + i} style={{ fontSize: "0.78rem", color: "var(--fg-mute)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: BOAT_COLORS[i % BOAT_COLORS.length], display: "inline-block" }} />
            {t.boatLabel}
          </span>
        ))}
      </div>
    </div>
  );
}
