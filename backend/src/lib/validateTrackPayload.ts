// ARCH.md §4「サーバ側再検証（フロントパースを信頼しない）」の実装。
// POST /api/sessions/:id/tracks の構造検証をここに集約する。

export interface TrackPayloadInput {
  boatLabel?: unknown;
  startSec?: unknown;
  pointCount?: unknown;
  gridJson?: unknown;
  rawGpx?: unknown;
  sourceApp?: unknown;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; status: 400 | 413; error: string };

const MAX_GRID_JSON_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_RAW_GPX_BYTES = 5 * 1024 * 1024; // 5MB
// startSec+pointCount が durationSec をわずかに超えるのは記録終了誤差として許容する（ARCH §4「+誤差」）
const DURATION_TOLERANCE_SEC = 5;

export function validateTrackPayload(
  body: TrackPayloadInput,
  durationSec: number
): ValidationResult {
  const { boatLabel, startSec, pointCount, gridJson, rawGpx } = body;

  if (typeof boatLabel !== "string" || boatLabel.trim().length === 0) {
    return { ok: false, status: 400, error: "boatLabel は必須です" };
  }
  if (!Number.isInteger(startSec) || (startSec as number) < 0) {
    return { ok: false, status: 400, error: "startSec は0以上の整数である必要があります" };
  }
  if (!Number.isInteger(pointCount) || (pointCount as number) <= 0) {
    return { ok: false, status: 400, error: "pointCount は正の整数である必要があります" };
  }
  if (typeof rawGpx !== "string" || rawGpx.length === 0) {
    return { ok: false, status: 400, error: "rawGpx は必須です" };
  }
  if (typeof gridJson !== "object" || gridJson === null) {
    return { ok: false, status: 400, error: "gridJson は必須です" };
  }

  const grid = gridJson as { lat?: unknown; lon?: unknown; gaps?: unknown };
  if (!Array.isArray(grid.lat) || !Array.isArray(grid.lon)) {
    return { ok: false, status: 400, error: "gridJson.lat / gridJson.lon は配列である必要があります" };
  }
  const lat = grid.lat as unknown[];
  const lon = grid.lon as unknown[];
  const pc = pointCount as number;

  if (lat.length !== lon.length || lat.length !== pc) {
    return {
      ok: false,
      status: 400,
      error: "gridJson.lat.length === gridJson.lon.length === pointCount が成立しません",
    };
  }

  for (let i = 0; i < lat.length; i++) {
    const la = lat[i];
    const lo = lon[i];
    if (typeof la !== "number" || la < -90 || la > 90) {
      return { ok: false, status: 400, error: `gridJson.lat[${i}] が[-90,90]の範囲外です` };
    }
    if (typeof lo !== "number" || lo < -180 || lo > 180) {
      return { ok: false, status: 400, error: `gridJson.lon[${i}] が[-180,180]の範囲外です` };
    }
  }

  if (grid.gaps !== undefined) {
    if (!Array.isArray(grid.gaps)) {
      return { ok: false, status: 400, error: "gridJson.gaps は配列である必要があります" };
    }
    for (const g of grid.gaps as unknown[]) {
      if (!Array.isArray(g) || g.length !== 2) {
        return { ok: false, status: 400, error: "gridJson.gaps の要素は[start,end]である必要があります" };
      }
      const [start, end] = g as [unknown, unknown];
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        return { ok: false, status: 400, error: "gridJson.gaps の start/end は整数である必要があります" };
      }
      if ((start as number) < 0 || (end as number) >= pc || (start as number) > (end as number)) {
        return {
          ok: false,
          status: 400,
          error: "gridJson.gaps の各要素は 0 ≦ start ≦ end < pointCount を満たす必要があります",
        };
      }
    }
  }

  // サイズ上限は「超過秒数」より優先して判定する（容量超過は常に413で一意に返す）
  const gridJsonBytes = Buffer.byteLength(JSON.stringify(gridJson), "utf8");
  if (gridJsonBytes > MAX_GRID_JSON_BYTES) {
    return { ok: false, status: 413, error: "gridJson が上限(2MB)を超えています" };
  }
  const rawGpxBytes = Buffer.byteLength(rawGpx, "utf8");
  if (rawGpxBytes > MAX_RAW_GPX_BYTES) {
    return { ok: false, status: 413, error: "rawGpx が上限(5MB)を超えています" };
  }

  if ((startSec as number) + pc > durationSec + DURATION_TOLERANCE_SEC) {
    return { ok: false, status: 400, error: "startSec + pointCount が durationSec を超えています" };
  }

  return { ok: true };
}
