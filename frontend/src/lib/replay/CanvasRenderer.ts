// CanvasRenderer: 投影・艇マーカー・テール・スケールバーの命令的描画（ARCH.md §4／ADR-001）。
// 状態を持たず、毎フレーム renderFrame() に現在時刻とプロジェクションを渡して呼ぶだけの純関数。
// SPIKE-01（spike/public/app.js）と同じ設計パターン（グリッドindexアクセス・cos(緯度)ローカル投影）
// を踏襲するが、コードは新規実装（spikeはコピー禁止・参照のみ）。

import { LocalProjection, RenderTrack, project, splitByGapRuns } from "./geo";

// DS rev.3の艇識別カラー（design-system/theme.json color.sailvlog.boats.dark、
// UI-DESIGN.md §4.2「6艇の識別ルール」）。Canvasは常時ダーク海図面のため、ダーク値を固定で使う。
// トークンは4色のみ（rev.3で意図的に増やしていない）。5・6艇目は0〜3を再利用する
// （index % BOAT_COLORS.length。線種による識別強化＝§7 #8は別タスクの範囲）。
export const BOAT_COLORS = ["#2f9fd1", "#ff5b52", "#f0a72e", "#34c07a"];

export interface RenderFrameOptions {
  tracks: RenderTrack[];
  proj: LocalProjection;
  simTimeSec: number;
  visibleTrackIds: Set<number>;
  /** 2艇が選ばれたときだけ、選択艇を強調して他艇を減光する */
  comparisonTrackIds?: Set<number>;
  /** テールで遡って表示する秒数 */
  tailSeconds: number;
}

export interface TrackEmphasis {
  alpha: number;
  lineWidth: number;
  markerRadius: number;
}

export function getTrackEmphasis(trackId: number, comparisonTrackIds?: Set<number>): TrackEmphasis {
  if (comparisonTrackIds?.size !== 2) {
    return { alpha: 1, lineWidth: 1.5, markerRadius: 5 };
  }
  return comparisonTrackIds.has(trackId)
    ? { alpha: 1, lineWidth: 3, markerRadius: 7 }
    : { alpha: 0.16, lineWidth: 1, markerRadius: 4 };
}

export function renderFrame(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, opts: RenderFrameOptions): void {
  const { tracks, proj, simTimeSec, visibleTrackIds, comparisonTrackIds, tailSeconds } = opts;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawScaleBar(ctx, canvas, proj);

  tracks.forEach((track, trackIndex) => {
    if (!visibleTrackIds.has(track.id)) return;

    const relSec = simTimeSec - track.startSec;
    const idx = Math.floor(relSec);
    if (idx < 0 || idx >= track.pointCount) return; // このトラックはまだ開始/既に終了

    const color = BOAT_COLORS[trackIndex % BOAT_COLORS.length];
    const emphasis = getTrackEmphasis(track.id, comparisonTrackIds);
    const { lat, lon, gaps } = track.gridJson;

    // テール（直近tailSeconds秒）。gapsに重なる区間は破線で描く。
    const tailFrom = Math.max(0, idx - tailSeconds);
    if (tailFrom < idx) {
      const runs = splitByGapRuns(gaps, tailFrom, idx);
      ctx.strokeStyle = color;
      ctx.globalAlpha = emphasis.alpha * 0.65;
      ctx.lineWidth = emphasis.lineWidth;
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
    ctx.globalAlpha = emphasis.alpha;
    ctx.beginPath();
    ctx.arc(x, y, emphasis.markerRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = comparisonTrackIds?.has(track.id) ? 2 : 1;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

function drawScaleBar(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, proj: LocalProjection): void {
  const meters = 500;
  const pxLen = meters * proj.scale;
  const x0 = 20;
  const y0 = canvas.height - 16;
  // DS rev.3の「水面上のグリッド/等深線インク」トークン相当（常時ダーク面上の白系半透明）
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + pxLen, y0);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.74)";
  ctx.font = "12px -apple-system, system-ui";
  ctx.fillText(`${meters} m`, x0, y0 - 6);
}
