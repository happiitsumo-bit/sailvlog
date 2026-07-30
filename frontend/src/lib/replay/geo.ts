// frontend/src/lib/replay/ — 再生エンジン（ARCH.md §4「再生エンジンモジュール境界」）
// ローカル平面投影＋欠測(gaps)判定の純関数群。Canvas API に依存しないためユニットテスト対象。

export interface RenderTrack {
  id: number;
  boatLabel: string;
  startSec: number;
  pointCount: number;
  gridJson: {
    lat: number[];
    lon: number[];
    gaps: [number, number][];
  };
}

export interface LocalProjection {
  /** 経度→X距離換算に使うcos(緯度中央値) */
  cosLat: number;
  minX: number;
  minY: number;
  /** メートル→ピクセル */
  scale: number;
  offsetX: number;
  offsetY: number;
  canvasHeight: number;
}

const M_PER_DEG_LAT = 111320;

/**
 * 全トラックの点列が収まるよう、ローカル平面投影（メルカトルでなく簡易な緯度経度→メートル換算）の
 * パラメータを1回だけ計算する（ADR-001）。以後の毎フレーム描画は project() の乗算のみで済む。
 */
export function computeProjection(
  tracks: RenderTrack[],
  canvasWidth: number,
  canvasHeight: number,
  marginPx = 40
): LocalProjection | null {
  let latMin = Infinity, latMax = -Infinity, lonMin = Infinity, lonMax = -Infinity;
  for (const t of tracks) {
    for (let i = 0; i < t.gridJson.lat.length; i++) {
      const lat = t.gridJson.lat[i];
      const lon = t.gridJson.lon[i];
      if (lat < latMin) latMin = lat;
      if (lat > latMax) latMax = lat;
      if (lon < lonMin) lonMin = lon;
      if (lon > lonMax) lonMax = lon;
    }
  }
  if (!Number.isFinite(latMin)) return null;

  const cosLat = Math.max(Math.cos(((latMin + latMax) / 2) * (Math.PI / 180)), 0.01);
  const minX = lonMin * cosLat * M_PER_DEG_LAT;
  const minY = latMin * M_PER_DEG_LAT;
  const maxX = lonMax * cosLat * M_PER_DEG_LAT;
  const maxY = latMax * M_PER_DEG_LAT;

  const w = Math.max(canvasWidth - marginPx * 2, 1);
  const h = Math.max(canvasHeight - marginPx * 2, 1);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const scale = Math.min(w / spanX, h / spanY);

  return {
    cosLat,
    minX,
    minY,
    scale,
    offsetX: marginPx + (w - spanX * scale) / 2,
    offsetY: marginPx + (h - spanY * scale) / 2,
    canvasHeight,
  };
}

/** 緯度経度をCanvas座標(px)へ投影する。北(緯度+)が画面上方向になるようYを反転する。 */
export function project(proj: LocalProjection, lat: number, lon: number): [number, number] {
  const x = lon * proj.cosLat * M_PER_DEG_LAT;
  const y = lat * M_PER_DEG_LAT;
  const sx = proj.offsetX + (x - proj.minX) * proj.scale;
  const sy = proj.canvasHeight - (proj.offsetY + (y - proj.minY) * proj.scale);
  return [sx, sy];
}

/** 与えたグリッドindexが gaps（線形補間で埋めた欠測区間）に含まれるかを判定する。 */
export function isIndexInGap(gaps: [number, number][], index: number): boolean {
  return gaps.some(([start, end]) => index >= start && index <= end);
}

/**
 * [from, to] の連続区間を、gapsとの重なりで「実測(solid)」「欠測補間(dashed)」の連続runに分割する。
 * CanvasRendererがテールを描くとき、run単位でsetLineDashを切り替えて破線表示するために使う。
 */
export function splitByGapRuns(
  gaps: [number, number][],
  from: number,
  to: number
): { from: number; to: number; dashed: boolean }[] {
  if (to < from) return [];
  const runs: { from: number; to: number; dashed: boolean }[] = [];
  let runStart = from;
  let runDashed = isIndexInGap(gaps, from);
  for (let i = from + 1; i <= to; i++) {
    const dashed = isIndexInGap(gaps, i);
    if (dashed !== runDashed) {
      runs.push({ from: runStart, to: i - 1, dashed: runDashed });
      runStart = i - 1; // 前runの終点と次runの始点をつなげて線を途切れさせない
      runDashed = dashed;
    }
  }
  runs.push({ from: runStart, to, dashed: runDashed });
  return runs;
}
