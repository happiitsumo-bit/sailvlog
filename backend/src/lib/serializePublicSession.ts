// T-31: GET /api/public/sessions/:slug の専用ホワイトリスト・シリアライザ（ADR-007）。
// 既存 GET /api/sessions/:id のレスポンス整形は再利用しない（意図的に別実装として新規に書く）。
// 「除外するものを列挙」ではなく「含めるものだけを列挙する」方式で組む。
//
// 禁止（含めてはならない）: rawGpx / isPublic=false の注釈 / email / teamId・メンバー一覧 / notes / publicViewCount
// （ARCH.md §4・SPEC-share1-phase1.md §5.2。T-31の禁止キー非含有テストで自動検証する）

type PublicSessionRow = {
  id: number;
  title: string;
  type: string;
  startedAt: Date;
  durationSec: number;
  venue: string | null;
  learningSummary: string | null;
  legs: unknown;
  visibility: string;
  publishedAt: Date | null;
  team: { name: string };
};

type PublicTrackRow = {
  id: number;
  boatLabel: string;
  startSec: number;
  pointCount: number;
  gridJson: unknown;
  sourceApp: string | null;
};

type PublicAnnotationRow = {
  id: number;
  tSec: number;
  trackId: number | null;
  legIndex: number | null;
  body: string;
};

export function serializePublicSession(
  session: PublicSessionRow,
  tracks: PublicTrackRow[],
  annotations: PublicAnnotationRow[]
) {
  return {
    session: {
      id: session.id,
      title: session.title,
      type: session.type,
      startedAt: session.startedAt,
      durationSec: session.durationSec,
      venue: session.venue,
      learningSummary: session.learningSummary,
      legs: session.legs,
      visibility: session.visibility,
      publishedAt: session.publishedAt,
      team: { name: session.team.name },
    },
    tracks: tracks.map((t) => ({
      id: t.id,
      boatLabel: t.boatLabel,
      startSec: t.startSec,
      pointCount: t.pointCount,
      gridJson: t.gridJson,
      sourceApp: t.sourceApp,
    })),
    // 呼び出し側で isPublic=true のみを渡す前提（DBクエリで絞り込み済み）。ここでは形だけ整える。
    annotations: annotations.map((a) => ({
      id: a.id,
      tSec: a.tSec,
      trackId: a.trackId,
      legIndex: a.legIndex,
      body: a.body,
    })),
  };
}
