// ReplayClock: 再生時刻の管理（ARCH.md §4 ADR-001「rAF+ref」）。
// Reactの外に状態を置き、毎フレームのReact再レンダーを避ける。呼び出し側（Reactコンポーネント）が
// useRefで1個保持し、rAFループから tick() を叩いてCanvasへ命令的に描画する。UIパネルへの同期は
// 呼び出し側が別途間引く（≦10Hz。ARCH.md §4）。

export class ReplayClock {
  private _simTimeSec = 0;
  private _playing = false;
  private _speed = 1;
  private readonly durationSec: number;

  constructor(durationSec: number) {
    this.durationSec = durationSec;
  }

  get simTimeSec(): number {
    return this._simTimeSec;
  }

  get playing(): boolean {
    return this._playing;
  }

  get speed(): number {
    return this._speed;
  }

  play(): void {
    this._playing = true;
  }

  pause(): void {
    this._playing = false;
  }

  setSpeed(speed: number): void {
    this._speed = speed;
  }

  seekTo(sec: number): void {
    this._simTimeSec = clamp(sec, 0, this.durationSec);
  }

  /** rAFコールバックから毎フレーム呼ぶ。再生中でなければ何もしない。末尾到達で自動停止する。 */
  tick(deltaMs: number): void {
    if (!this._playing) return;
    const next = this._simTimeSec + (deltaMs / 1000) * this._speed;
    if (next >= this.durationSec) {
      this._simTimeSec = this.durationSec;
      this._playing = false;
    } else {
      this._simTimeSec = next;
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
