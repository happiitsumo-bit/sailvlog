// qa-engineer (T-90) 先回りスキャフォールド。
// T-12（セッションAPI）実装後に使う、ARCH.md §4 の数値バリデーション境界をカバーするための
// リクエストボディ・ビルダー群。実データGPXは不要（サーバはXMLを見ない＝ADR-006）なので、
// gridJson/rawGpxはJS側でそのまま組み立てる。
//
// 使い方（T-12実装後）:
//   const body = validTrackPayload();          // 素直に通るはずの正常系
//   const bad  = validTrackPayload({ gridJson: { ...body.gridJson, lat: [999, ...] } }); // 400系の材料
//
// 各 invalid* は「どのARCH §4ルールに違反するか」がコメントで分かるようにしてある。

export type TrackPayload = {
  boatLabel: string;
  startSec: number;
  pointCount: number;
  gridJson: { lat: number[]; lon: number[]; gaps: [number, number][] };
  rawGpx: string;
  sourceApp?: string;
};

function buildGrid(pointCount: number, baseLat = 35.302, baseLon = 139.48): { lat: number[]; lon: number[] } {
  const lat: number[] = [];
  const lon: number[] = [];
  for (let i = 0; i < pointCount; i++) {
    lat.push(baseLat + i * 0.00001);
    lon.push(baseLon + i * 0.00001);
  }
  return { lat, lon };
}

function fakeRawGpx(pointCount: number): string {
  const pts = Array.from(
    { length: pointCount },
    (_, i) => `<trkpt lat="35.30${i}" lon="139.48${i}"><time>2026-07-24T05:00:${String(i % 60).padStart(2, "0")}Z</time></trkpt>`
  ).join("\n");
  return `<?xml version="1.0"?><gpx><trk><trkseg>${pts}</trkseg></trk></gpx>`;
}

/** 正常系: そのままPOSTすれば201が返るはずの最小payload */
export function validTrackPayload(overrides: Partial<TrackPayload> = {}): TrackPayload {
  const pointCount = 10;
  const { lat, lon } = buildGrid(pointCount);
  return {
    boatLabel: "4423 田中/佐藤",
    startSec: 0,
    pointCount,
    gridJson: { lat, lon, gaps: [] },
    rawGpx: fakeRawGpx(pointCount),
    sourceApp: "Geo Tracker",
    ...overrides,
  };
}

/** 違反: lat配列とlon配列とpointCountの長さが一致しない */
export function payloadWithLengthMismatch(): TrackPayload {
  const p = validTrackPayload();
  return { ...p, gridJson: { ...p.gridJson, lat: p.gridJson.lat.slice(0, -1) } };
}

/** 違反: lat が [-90, 90] の範囲外 */
export function payloadWithLatOutOfRange(): TrackPayload {
  const p = validTrackPayload();
  const lat = [...p.gridJson.lat];
  lat[0] = 90.5;
  return { ...p, gridJson: { ...p.gridJson, lat } };
}

/** 違反: lon が [-180, 180] の範囲外 */
export function payloadWithLonOutOfRange(): TrackPayload {
  const p = validTrackPayload();
  const lon = [...p.gridJson.lon];
  lon[0] = -180.1;
  return { ...p, gridJson: { ...p.gridJson, lon } };
}

/** 違反: gaps の要素が [start,end] で end < start（境界0 ≦ start ≦ end < pointCount 違反その1） */
export function payloadWithGapStartAfterEnd(): TrackPayload {
  const p = validTrackPayload();
  return { ...p, gridJson: { ...p.gridJson, gaps: [[5, 3]] } };
}

/** 違反: gaps の end が pointCount 以上（境界違反その2） */
export function payloadWithGapEndOutOfBounds(): TrackPayload {
  const p = validTrackPayload();
  return { ...p, gridJson: { ...p.gridJson, gaps: [[0, p.pointCount]] } };
}

/** 違反: gaps の start が負（境界違反その3） */
export function payloadWithGapStartNegative(): TrackPayload {
  const p = validTrackPayload();
  return { ...p, gridJson: { ...p.gridJson, gaps: [[-1, 2]] } };
}

/** 境界値OK: gaps = [[0, pointCount-1]]（全区間ギャップ。0 ≦ start ≦ end < pointCount を満たすギリギリ正常系） */
export function payloadWithGapAtBoundary(): TrackPayload {
  const p = validTrackPayload();
  return { ...p, gridJson: { ...p.gridJson, gaps: [[0, p.pointCount - 1]] } };
}

/** 違反: startSec + pointCount が session.durationSec を超える（呼び出し側でdurationSecと突き合わせる想定） */
export function payloadExceedingDuration(durationSec: number): TrackPayload {
  const p = validTrackPayload();
  return { ...p, startSec: durationSec }; // どんなpointCountでもdurationSecちょうどから開始→即座に超過
}

/** 違反: gridJson が概算2MB超（容量上限） */
export function payloadWithOversizedGridJson(): TrackPayload {
  // 1点あたりlat/lonの数値文字列で概算16バイト強。2MB超えには十分な点数まで増やす。
  const pointCount = 140_000;
  const { lat, lon } = buildGrid(pointCount);
  return {
    ...validTrackPayload(),
    pointCount,
    gridJson: { lat, lon, gaps: [] },
  };
}

/** 違反: rawGpx が5MB超 */
export function payloadWithOversizedRawGpx(): TrackPayload {
  const p = validTrackPayload();
  return { ...p, rawGpx: "x".repeat(5 * 1024 * 1024 + 1) };
}

export type AnnotationPayload = { tSec: number; body: string; trackId?: number; legIndex?: number };

export function validAnnotationPayload(overrides: Partial<AnnotationPayload> = {}): AnnotationPayload {
  return { tSec: 10, body: "ここでタック", ...overrides };
}

/** 違反: tSec が [0, durationSec] の範囲外 */
export function annotationWithTSecOutOfRange(durationSec: number): AnnotationPayload {
  return validAnnotationPayload({ tSec: durationSec + 1 });
}

/** 違反: body が2000字超 */
export function annotationWithBodyTooLong(): AnnotationPayload {
  return validAnnotationPayload({ body: "あ".repeat(2001) });
}
