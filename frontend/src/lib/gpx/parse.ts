// frontend/src/lib/gpx/ — GPXパース＋1Hzグリッド正規化（ARCH.md §4「再生エンジンモジュール境界」）
// DOM API（DOMParser）以外に依存しない純関数群。ユニットテスト対象（T-11）。
// サーバ側の構造再検証（ARCH.md §4）はこのモジュールの出力を信頼しない別実装であり、ここでは重複させない。

export interface GpxPoint {
  lat: number;
  lon: number;
  /** UNIX epoch ミリ秒 */
  timeMs: number;
}

export interface NormalizedTrack {
  /** セッション基準時刻からのオフセット（秒）。normalizeToGrid の sessionStartMs 引数に対する相対値 */
  startSec: number;
  /** グリッド点数。gridJson.lat/lon の配列長と一致 */
  pointCount: number;
  gridJson: {
    lat: number[];
    lon: number[];
    /** 欠測区間（線形補間で埋めた範囲）。各要素 [start, end]（0 ≦ start ≦ end < pointCount） */
    gaps: [number, number][];
  };
}

/**
 * GPX 1.1 のXML文字列をパースし、trkpt（lat/lon/time必須）の点列を時刻昇順で返す。
 * 以下は拒否（例外を投げる。部分結果は返さない）:
 *   - 不正なXML（DOMParserのparsererror）
 *   - trkptが0件
 *   - lat/lon属性の欠落・非数値
 *   - time要素の欠落・パース不能
 *   - 時刻の逆転/重複（各点のtimeが直前の点より真に後であること）
 */
export function parseGpx(xmlText: string): GpxPoint[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");

  if (doc.querySelector("parsererror")) {
    throw new GpxParseError("GPXの解析に失敗しました（不正なXML）");
  }

  const trkpts = Array.from(doc.querySelectorAll("trkpt"));
  if (trkpts.length === 0) {
    throw new GpxParseError("GPXにtrkpt（トラックポイント）が含まれていません");
  }

  const points: GpxPoint[] = trkpts.map((el, i) => {
    const latAttr = el.getAttribute("lat");
    const lonAttr = el.getAttribute("lon");
    if (latAttr === null || lonAttr === null) {
      throw new GpxParseError(`trkpt[${i}] に lat/lon 属性がありません`);
    }
    const lat = Number(latAttr);
    const lon = Number(lonAttr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new GpxParseError(`trkpt[${i}] の lat/lon が数値として不正です`);
    }

    const timeText = el.querySelector("time")?.textContent;
    if (!timeText) {
      throw new GpxParseError(`trkpt[${i}] に time 要素がありません`);
    }
    const timeMs = Date.parse(timeText);
    if (Number.isNaN(timeMs)) {
      throw new GpxParseError(`trkpt[${i}] の time が日時として不正です: "${timeText}"`);
    }

    return { lat, lon, timeMs };
  });

  for (let i = 1; i < points.length; i++) {
    if (points[i].timeMs <= points[i - 1].timeMs) {
      throw new GpxParseError(
        `時刻が逆転または重複しています（trkpt[${i - 1}] → trkpt[${i}]）`
      );
    }
  }

  return points;
}

export class GpxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GpxParseError";
  }
}

/**
 * 複数トラックのセッション基準時刻（t=0）を決める。全トラックの最初の点のうち最も早い時刻。
 */
export function computeSessionStart(tracksPoints: GpxPoint[][]): number {
  if (tracksPoints.length === 0) {
    throw new GpxParseError("トラックが1件もありません");
  }
  return Math.min(...tracksPoints.map((points) => points[0].timeMs));
}

/**
 * 1点列を、sessionStartMs を基準とした1Hzグリッドへ正規化する。
 * 欠測区間（記録間隔が1秒を超えて空いた箇所）は線形補間で埋め、gapsに記録する。
 */
export function normalizeToGrid(points: GpxPoint[], sessionStartMs: number): NormalizedTrack {
  if (points.length === 0) {
    throw new GpxParseError("正規化対象の点列が空です");
  }

  const t0 = points[0].timeMs;
  const startSec = Math.round((t0 - sessionStartMs) / 1000);

  // 相対秒 -> 実測点 のマップ（同一秒に複数点があれば先勝ち）
  const bySec = new Map<number, GpxPoint>();
  for (const p of points) {
    const relSec = Math.round((p.timeMs - t0) / 1000);
    if (!bySec.has(relSec)) bySec.set(relSec, p);
  }

  const lastRelSec = Math.max(...bySec.keys());
  const pointCount = lastRelSec + 1;

  const lat = new Array<number>(pointCount);
  const lon = new Array<number>(pointCount);
  const gaps: [number, number][] = [];

  let gapStart: number | null = null;
  for (let i = 0; i < pointCount; i++) {
    const known = bySec.get(i);
    if (known) {
      lat[i] = known.lat;
      lon[i] = known.lon;
      if (gapStart !== null) {
        gaps.push([gapStart, i - 1]);
        gapStart = null;
      }
    } else {
      if (gapStart === null) gapStart = i;
    }
  }
  // 末尾が欠測のまま閉じていないケースは構造上発生しない
  // （pointCountは既知の最大相対秒から決まるため、最後の点は必ず既知）。

  // 欠測点を前後の既知点から線形補間
  for (const [start, end] of gaps) {
    const before = bySec.get(start - 1)!;
    const after = bySec.get(end + 1)!;
    const span = end + 1 - (start - 1);
    for (let i = start; i <= end; i++) {
      const frac = (i - (start - 1)) / span;
      lat[i] = before.lat + (after.lat - before.lat) * frac;
      lon[i] = before.lon + (after.lon - before.lon) * frac;
    }
  }

  return { startSec, pointCount, gridJson: { lat, lon, gaps } };
}
