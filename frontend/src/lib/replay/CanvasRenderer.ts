// CanvasRenderer: 投影・艇マーカー・テール・スケールバーの命令的描画（ARCH.md §4／ADR-001）。
// 状態を持たず、毎フレーム renderFrame() に現在時刻とプロジェクションを渡して呼ぶだけの純関数。
// SPIKE-01（spike/public/app.js）と同じ設計パターン（グリッドindexアクセス・cos(緯度)ローカル投影）
// を踏襲するが、コードは新規実装（spikeはコピー禁止・参照のみ）。

import { LocalProjection, RenderTrack, project, splitByGapRuns } from "./geo";

export const BOAT_COLORS = ["#c1552c", "#2c6e8f", "#4a7c59", "#8a5fb0", "#c9a13b", "#b0475f", "#5f7470", "#a3623f"];

export interface RenderFrameOptions {
  tracks: RenderTrack[];
  proj: LocalProjection;
  simTimeSec: number;
  visibleTrackIds: Set<number>;
  /** テールで遡って表示する秒数 */
  tailSeconds: number;
}

export function renderFrame(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, opts: RenderFrameOptions): void {
  const { tracks, proj, simTimeSec, visibleTrackIds, tailSeconds } = opts;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawScaleBar(ctx, canvas, proj);

  tracks.forEach((track, trackIndex) => {
    if (!visibleTrackIds.has(track.id)) return;

    const relSec = simTimeSec - track.startSec;
    const idx = Math.floor(relSec);
    if (idx < 0 || idx >= track.pointCount) return; // このトラックはまだ開始/既に終了

    const color = BOAT_COLORS[trackIndex % BOAT_COLORS.length];
    const { lat, lon, gaps } = track.gridJson;

    // テール（直近tailSeconds秒）。gapsに重なる区間は破線で描く。
    const tailFrom = Math.max(0, idx - tailSeconds);
    if (tailFrom < idx) {
      const runs = splitByGapRuns(gaps, tailFrom, idx);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      for (const run of runs) {
        ctx.setLineDash(run.dashed ? [4, 3] : []);
        ctx.beginPath();
        for (let i = run.from; i <= run.to; i++) {
          const [x, y] = project(proj, lat[i], lon[i]);
          if (i === run.from) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 現在位置マーカー
    const [x, y] = project(proj, lat[idx], lon[idx]);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  });
}

function drawScaleBar(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, proj: LocalProjection): void {
  const meters = 500;
  const pxLen = meters * proj.scale;
  const x0 = 20;
  const y0 = canvas.height - 16;
  ctx.strokeStyle = "#9fb2cf";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + pxLen, y0);
  ctx.stroke();
  ctx.fillStyle = "#6b7a8f";
  ctx.font = "12px system-ui";
  ctx.fillText(`${meters} m`, x0, y0 - 6);
}
