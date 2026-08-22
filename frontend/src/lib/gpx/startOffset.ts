// Issue #30: 取込プレビューで艇ごとの記録開始時刻の差（startSec）を検知・表示するための純関数群。
// 補正は行わない（YAGNI・実測データが無いため）。あくまで「気づけるようにする」のがスコープ。

export type StartOffsetSeverity = "aligned" | "notable" | "large";

export interface TrackStartOffset {
  boatLabel: string;
  startSec: number;
  severity: StartOffsetSeverity;
}

export interface StartOffsetSummary {
  offsets: TrackStartOffset[];
  /** 最も遅く記録が始まった艇のstartSec。この秒数が経過するまで全艇はそろわない（先頭の無風区間の目安） */
  allBoatsPresentAtSec: number;
}

/**
 * notable: スマホ/GPSロガーの時計ズレとして典型的に起こりうる範囲（数十秒）。
 * large: 「録画ボタンを早押しして陸上待機中から記録している」等、時計ズレでは説明しにくい規模（10分超）。
 * 実測データが集まるまでの暫定値（Issue #30本文）。
 */
export const NOTABLE_OFFSET_SEC = 60;
export const LARGE_OFFSET_SEC = 600;

function classifySeverity(startSec: number): StartOffsetSeverity {
  if (startSec >= LARGE_OFFSET_SEC) return "large";
  if (startSec >= NOTABLE_OFFSET_SEC) return "notable";
  return "aligned";
}

/**
 * 各艇のstartSec（セッション基準時刻からの遅れ秒数）から、表示用のサマリを作る。
 */
export function computeStartOffsetSummary(
  tracks: { boatLabel: string; startSec: number }[]
): StartOffsetSummary {
  const offsets = tracks.map((t) => ({
    boatLabel: t.boatLabel,
    startSec: t.startSec,
    severity: classifySeverity(t.startSec),
  }));
  const allBoatsPresentAtSec = tracks.length === 0 ? 0 : Math.max(...tracks.map((t) => t.startSec));
  return { offsets, allBoatsPresentAtSec };
}

/** 秒数を「M分S秒」形式の人が読める文字列にする（0秒は「基準艇」と表示） */
export function formatOffsetSec(sec: number): string {
  if (sec <= 0) return "基準艇（0秒）";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}秒`;
  if (s === 0) return `${m}分`;
  return `${m}分${s}秒`;
}
