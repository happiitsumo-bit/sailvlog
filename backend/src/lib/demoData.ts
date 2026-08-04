// Issue #35: 本番にログイン不要で見られるデモを1本置くための合成データ生成。
// 実在の部・実在の人を想起させないよう、チーム名・艇ラベル・海域名はすべて架空にする（C-01対策も兼ねる）。
// 座標も特定の実在ハーバーを指さないよう、緯度経度は架空の海域として扱う（値そのものに意味は無い）。

export const DEMO_TEAM_SLUG = "sailvlog-demo-team";
export const DEMO_TEAM_NAME = "架空大学ヨット部（デモ用）";
export const DEMO_PUBLIC_SLUG = "sailvlog-demo";
export const DEMO_UPLOADER_EMAIL = "demo-uploader@sailvlog.invalid";

export const DEMO_LEARNING_SUMMARY =
  "※このセッションは合成データです（架空のチーム・艇名・記録）。実際の練習記録ではなく、sailvlogの画面を体験していただくためのサンプルです。" +
  "上マークへ向けてタッキングを繰り返し、風上マークを回航してからは一気にダウンウィンドで加速しています。";

export interface DemoTrackPoint {
  lat: number;
  lon: number;
  timeMs: number;
}

export interface DemoTrackDefinition {
  boatLabel: string;
  points: DemoTrackPoint[];
}

export interface DemoAnnotationDefinition {
  tSec: number;
  body: string;
}

const DEMO_CENTER_LAT = 34.9; // 架空の海域（特定の実在ハーバーを指さない）
const DEMO_CENTER_LON = 139.6;
const METERS_PER_DEG_LAT = 111_000;

function metersToLat(m: number): number {
  return m / METERS_PER_DEG_LAT;
}
function metersToLon(m: number, atLat: number): number {
  return m / (METERS_PER_DEG_LAT * Math.cos((atLat * Math.PI) / 180));
}

/**
 * 1Hzのジグザグ（タッキング）→ダウンウィンドの簡易帆走軌跡を生成する。
 * 実測GPXではなく合成データであることが前提（Issue #35）。
 */
function buildTrackPoints(opts: {
  startMs: number;
  durationSec: number;
  startOffsetMeters: [number, number]; // [east, north] スタート位置のオフセット
  speedMps: number;
  tackPeriodSec: number;
  tackAngleDeg: number;
}): DemoTrackPoint[] {
  const { startMs, durationSec, startOffsetMeters, speedMps, tackPeriodSec, tackAngleDeg } = opts;
  const points: DemoTrackPoint[] = [];
  const upwindSec = Math.floor(durationSec * 0.6);

  let east = startOffsetMeters[0];
  let north = startOffsetMeters[1];

  for (let t = 0; t < durationSec; t++) {
    const isUpwind = t < upwindSec;
    // タッキング: 上マークまでは北向きを基準に±tackAngleDegでジグザグ。
    // ダウンウィンド: 南向きに直進で戻る（デモとして見やすい形にする）。
    const tackSide = Math.floor(t / tackPeriodSec) % 2 === 0 ? 1 : -1;
    const headingDeg = isUpwind ? tackSide * tackAngleDeg : 180;
    const headingRad = (headingDeg * Math.PI) / 180;

    east += speedMps * Math.sin(headingRad);
    north += speedMps * Math.cos(headingRad);

    const lat = DEMO_CENTER_LAT + metersToLat(north);
    const lon = DEMO_CENTER_LON + metersToLon(east, DEMO_CENTER_LAT);
    points.push({ lat, lon, timeMs: startMs + t * 1000 });
  }

  return points;
}

/** GpxPoint[]相当を1Hzのまま（欠測なし）GpxのXML文字列に変換する。frontendのparseGpxが受理できる最小限の構造。 */
function toGpxXml(points: DemoTrackPoint[]): string {
  const trkpts = points
    .map(
      (p) =>
        `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><time>${new Date(p.timeMs).toISOString()}</time></trkpt>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="sailvlog-demo-data"><trk><trkseg>${trkpts}</trkseg></trk></gpx>`;
}

export interface DemoSessionData {
  session: {
    title: string;
    type: "practice";
    startedAt: Date;
    durationSec: number;
    venue: string;
    learningSummary: string;
  };
  tracks: Array<{
    boatLabel: string;
    startSec: number;
    pointCount: number;
    gridJson: { lat: number[]; lon: number[]; gaps: [number, number][] };
    rawGpx: string;
    sourceApp: string;
  }>;
  annotations: DemoAnnotationDefinition[];
}

/** デモセッション一式（合成データ）を組み立てる。DBアクセスは行わない純関数。 */
export function buildDemoSessionData(): DemoSessionData {
  // 固定日時（デモの再現性のため）。架空の練習日として扱う。
  const sessionStartMs = Date.parse("2026-06-15T05:30:00.000Z");
  const durationSec = 360; // 6分

  const trackDefs: DemoTrackDefinition[] = [
    {
      boatLabel: "デモ艇1",
      points: buildTrackPoints({
        startMs: sessionStartMs,
        durationSec,
        startOffsetMeters: [0, 0],
        speedMps: 2.2,
        tackPeriodSec: 35,
        tackAngleDeg: 38,
      }),
    },
    {
      boatLabel: "デモ艇2",
      points: buildTrackPoints({
        startMs: sessionStartMs + 3000, // 3秒遅れでスタート（艇間の位相差を再現）
        durationSec: durationSec - 3,
        startOffsetMeters: [25, -10],
        speedMps: 2.35,
        tackPeriodSec: 30,
        tackAngleDeg: 34,
      }),
    },
  ];

  const tracks = trackDefs.map((def) => {
    const t0 = def.points[0].timeMs;
    const startSec = Math.round((t0 - sessionStartMs) / 1000);
    return {
      boatLabel: def.boatLabel,
      startSec,
      pointCount: def.points.length,
      gridJson: {
        lat: def.points.map((p) => p.lat),
        lon: def.points.map((p) => p.lon),
        gaps: [] as [number, number][],
      },
      rawGpx: toGpxXml(def.points),
      sourceApp: "sailvlog-demo-data",
    };
  });

  const annotations: DemoAnnotationDefinition[] = [
    { tSec: 40, body: "（サンプル注釈）1本目のタッキングでデモ艇2がわずかにリードしています。" },
    { tSec: 220, body: "（サンプル注釈）上マーク回航からダウンウィンドで一気に加速。" },
  ];

  return {
    session: {
      title: "デモセッション（合成データ）",
      type: "practice",
      startedAt: new Date(sessionStartMs),
      durationSec,
      venue: "デモ海域（架空）",
      learningSummary: DEMO_LEARNING_SUMMARY,
    },
    tracks,
    annotations,
  };
}
