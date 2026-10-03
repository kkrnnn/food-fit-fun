import type { PoseInput } from './PoseMapper';
export interface HoldState { progress: number; completed: boolean; armed: boolean }
/** Camera gestures cannot unlock browser audio; callers unlock it during setup taps. */
export class HandHoldStart {
  private armed = false;
  private side: 15 | 16 | null = null;
  private since = 0;
  private last = -Infinity;
  private done = false;
  private progress = 0;
  reset(): void { this.armed = false; this.side = null; this.last = -Infinity; this.done = false; this.progress = 0; }
  tick(now: number): HoldState {
    if (now - this.last > 250 && !this.done) { this.side = null; this.progress = 0; this.armed = false; }
    return this.state(false);
  }
  ingest(points: PoseInput, now: number, ready: boolean): HoldState {
    if (!ready || !Number.isFinite(now) || now <= this.last) { this.reset(); return this.state(false); }
    if (now - this.last > 250) { this.side = null; this.progress = 0; this.armed = false; }
    this.last = now;
    if (this.done) return this.state(false);
    const valid = (index: number) => { const p = points?.[index]; return p && Number.isFinite(p.y) && (p.visibility ?? 1) >= .6 && (p.presence ?? 1) >= .6 ? p : null; };
    const ls = valid(11), rs = valid(12), lh = valid(23), rh = valid(24);
    if (!ls || !rs || !lh || !rh) { this.reset(); return this.state(false); }
    const height = (lh.y + rh.y - ls.y - rs.y) / 2;
    if (height < .06) { this.reset(); return this.state(false); }
    const wrists = [valid(15), valid(16)];
    const shoulders = [ls, rs];
    const lowered = wrists.some((p, i) => p && p.y >= shoulders[i].y - height * .02);
    const raised = (index: number, hysteresis: boolean) => wrists[index] && wrists[index]!.y < shoulders[index].y - height * (hysteresis ? .06 : .12);
    if (!this.armed) { if (lowered && !raised(0, false) && !raised(1, false)) this.armed = true; return this.state(false); }
    const next = this.side && raised(this.side - 15, true) ? this.side : raised(0, false) ? 15 : raised(1, false) ? 16 : null;
    if (next !== this.side) { this.side = next; this.since = now; this.progress = 0; }
    if (!next) { this.progress = 0; return this.state(false); }
    this.progress = Math.min(1, (now - this.since) / 1500);
    if (this.progress >= 1) { this.done = true; return this.state(true); }
    return this.state(false);
  }
  private state(completed: boolean): HoldState { return { progress: this.progress, completed, armed: this.armed }; }
}
