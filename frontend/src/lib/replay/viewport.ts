// Canvas上のズーム・パン用ビューポート変換（Issue #37 ADR-001踏襲: Canvas 2Dの座標変換のみ・新規npm依存なし）。
// computeProjection()が1回だけ計算する「全体表示」の投影(LocalProjection)の上に、
// ユーザー操作由来のズーム倍率とパン量だけを重ねる薄い層として分離する。
// DOM/Canvas APIに依存しない純関数のみを置き、vitest対象にする。

export interface Viewport {
  /** 全体表示(fit-to-bounds)を1とする倍率 */
  zoom: number;
  /** 追加のピクセル平行移動（X） */
  panX: number;
  /** 追加のピクセル平行移動（Y） */
  panY: number;
}

export const IDENTITY_VIEWPORT: Viewport = { zoom: 1, panX: 0, panY: 0 };

/** リセット（完了条件: 全体表示に戻す手段）。常に新しいオブジェクトを返す。 */
export function resetViewport(): Viewport {
  return { ...IDENTITY_VIEWPORT };
}

/**
 * カーソル位置(cx, cy: canvas内部座標)を中心にズームする。
 * ズーム後もcx,cy直下の投影点が同じ画面位置に留まるようpanX/panYを再計算する。
 */
export function zoomAt(
  viewport: Viewport,
  cx: number,
  cy: number,
  factor: number,
  minZoom = 1,
  maxZoom = 20
): Viewport {
  const newZoom = Math.min(maxZoom, Math.max(minZoom, viewport.zoom * factor));
  const actualFactor = newZoom / viewport.zoom;
  return {
    zoom: newZoom,
    panX: cx - (cx - viewport.panX) * actualFactor,
    panY: cy - (cy - viewport.panY) * actualFactor,
  };
}

/** ドラッグ量(dx, dy: canvas内部ピクセル)だけ平行移動する。 */
export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, panX: viewport.panX + dx, panY: viewport.panY + dy };
}

/**
 * マウス/タッチの移動量（CSSピクセル）を canvas 内部ピクセルへ変換する。
 *
 * レビュー指摘（PR #50）: zoomAt と pinch は toCanvasPoint() で内部座標に直していたのに、
 * マウスドラッグのパンだけ clientX/clientY の差分をそのまま渡していた。
 * canvas の内部解像度（canvas.width）と表示サイズ（rect.width）が一致しない状況
 * ——レスポンシブで縮んだとき、DPR>1 のとき——では、ズームの中心とパン量の座標系が食い違い、
 * カーソルより速く/遅く地図が動く。移動量にも同じ倍率をかける。
 */
export function toCanvasDelta(
  dx: number,
  dy: number,
  rectWidth: number,
  rectHeight: number,
  canvasWidth: number,
  canvasHeight: number
): [number, number] {
  // 表示サイズが0（非表示・レイアウト前）のときは倍率を求められないので等倍で返す
  const scaleX = rectWidth > 0 ? canvasWidth / rectWidth : 1;
  const scaleY = rectHeight > 0 ? canvasHeight / rectHeight : 1;
  return [dx * scaleX, dy * scaleY];
}

/** 投影済みのcanvas座標(x, y)にビューポート変換(ズーム＋パン)を適用する。 */
export function applyViewport(viewport: Viewport, x: number, y: number): [number, number] {
  return [x * viewport.zoom + viewport.panX, y * viewport.zoom + viewport.panY];
}

/** 2点間の距離（ピンチのつまみ幅）。 */
export function pinchDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** 2点の中点（ピンチの中心。ズームの基準点として使う）。 */
export function pinchMidpoint(x1: number, y1: number, x2: number, y2: number): [number, number] {
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}
