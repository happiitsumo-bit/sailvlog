/**
 * Canvas上の左右スワイプ→シーク秒数への変換（UI-DESIGN §4.6・T-25）。
 * ページコンポーネント（page.tsx）から純関数として切り出し、vitestで回帰を捕まえられるようにする
 * （@testing-library/reactが未導入のためコンポーネント自体のテストは今回もできないが、
 * ロジック部分だけは純関数化してテスト可能にする）。
 */

const SWIPE_THRESHOLD_PX = 40;
const SWIPE_STEP_SEC = 5;

/**
 * @param dx タッチ開始点から終了点までのX方向の移動量（px、右方向が正）
 * @returns シークすべき秒数（右スワイプ=+5秒、左スワイプ=-5秒、閾値未満は0＝シークしない）
 */
export function computeSwipeSeekStepSec(dx: number): number {
  if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return 0;
  return dx > 0 ? SWIPE_STEP_SEC : -SWIPE_STEP_SEC;
}

/** シーク先の時刻を [0, durationSec] にクランプする */
export function clampSeekTarget(currentSec: number, stepSec: number, durationSec: number): number {
  return Math.min(Math.max(0, currentSec + stepSec), durationSec);
}
