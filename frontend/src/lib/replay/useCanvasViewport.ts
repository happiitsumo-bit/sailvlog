"use client";
// Canvas上のホイールズーム・ドラッグパン・ピンチ操作をまとめたReactフック（Issue #37）。
// 部内版(/sessions/[id])と公開版(/p/[slug])の両方が同じ実装を使うことで、
// 「描画コードを分岐も複製もしない」（ADR-007の再利用方針）を操作系にも適用する。
// 数値変換そのもの(zoomAt/panBy/pinch*)は./viewportの純関数に委譲し、ここはDOMイベントの配線のみを担う
// （@testing-library/react未導入のためこのフック自体はユニットテスト対象外。touchSeek.tsと同じ切り分け）。

import { RefObject, useCallback, useEffect, useRef } from "react";
import { IDENTITY_VIEWPORT, Viewport, zoomAt, panBy, resetViewport, pinchDistance, pinchMidpoint } from "./viewport";

const ZOOM_STEP = 1.15;
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

function toCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
}

export function useCanvasViewport(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const viewportRef = useRef<Viewport>(IDENTITY_VIEWPORT);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number; midX: number; midY: number } | null>(null);

  // wheelはReactのonWheelだとpassiveリスナーになりpreventDefault()が効かないため、
  // ネイティブaddEventListenerで{passive:false}を明示する。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const [cx, cy] = toCanvasPoint(canvas!, e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      viewportRef.current = zoomAt(viewportRef.current, cx, cy, factor, MIN_ZOOM, MAX_ZOOM);
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [canvasRef]);

  /** マウスドラッグでパン（デスクトップ）。 */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    viewportRef.current = panBy(viewportRef.current, e.clientX - drag.x, e.clientY - drag.y);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  /**
   * 2本指タッチの開始を検出する。既存の1本指スワイプ・シーク（touchSeek.ts）と競合しないよう、
   * 呼び出し側は戻り値がtrueの間は1本指用のロジック（touchStartXRef設定等）をスキップする。
   */
  const handleTouchStartPinch = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>): boolean => {
      const canvas = canvasRef.current;
      if (!canvas || e.touches.length !== 2) {
        pinchRef.current = null;
        return false;
      }
      const [a, b] = [e.touches[0], e.touches[1]];
      const [x1, y1] = toCanvasPoint(canvas, a.clientX, a.clientY);
      const [x2, y2] = toCanvasPoint(canvas, b.clientX, b.clientY);
      const [midX, midY] = pinchMidpoint(x1, y1, x2, y2);
      pinchRef.current = { distance: pinchDistance(x1, y1, x2, y2), midX, midY };
      return true;
    },
    [canvasRef]
  );

  /** 2本指のつまみ幅の変化=ズーム、中点の移動=パン、として毎touchmoveで反映する。 */
  const handleTouchMovePinch = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>): boolean => {
      const canvas = canvasRef.current;
      const pinch = pinchRef.current;
      if (!canvas || !pinch || e.touches.length !== 2) return false;
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const [x1, y1] = toCanvasPoint(canvas, a.clientX, a.clientY);
      const [x2, y2] = toCanvasPoint(canvas, b.clientX, b.clientY);
      const newDistance = pinchDistance(x1, y1, x2, y2);
      const [midX, midY] = pinchMidpoint(x1, y1, x2, y2);
      const factor = pinch.distance > 0 ? newDistance / pinch.distance : 1;
      viewportRef.current = zoomAt(viewportRef.current, pinch.midX, pinch.midY, factor, MIN_ZOOM, MAX_ZOOM);
      viewportRef.current = panBy(viewportRef.current, midX - pinch.midX, midY - pinch.midY);
      pinchRef.current = { distance: newDistance, midX, midY };
      return true;
    },
    [canvasRef]
  );

  const handleTouchEndPinch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) pinchRef.current = null;
  }, []);

  const reset = useCallback(() => {
    viewportRef.current = resetViewport();
  }, []);

  return {
    viewportRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStartPinch,
    handleTouchMovePinch,
    handleTouchEndPinch,
    reset,
  };
}
