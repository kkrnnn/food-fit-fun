import type { PoseInput } from './PoseMapper';
import { JUMP_TUNING, type Sensitivity } from './CameraTuning';
import { torsoSample } from './TorsoPose';
import { headSample, upperHeadTarget } from './HeadPose';
export interface JumpCalibration { head: number; height: number; threshold: number }
/** Cross the fixed upper head target once, then return below it to rearm. */
export class JumpGesture {
  constructor(private sensitivity: Sensitivity = 'normal') {}
  private calibrated: JumpCalibration | null = null;
  private last = -Infinity;
  private baseline: { head: number; height: number } | null = null;
  private previousRise = 0;
  private neutralSince = 0;
  private rising = false;
  private armed = false;
  private landingSince: number | null = null;
  private emittedAt = -Infinity;
  setCalibration(value: JumpCalibration | null): void { this.calibrated = value; this.reset(); }
  setSensitivity(value: Sensitivity): void { this.sensitivity = value; this.reset(); }
  get targetY(): number | null {
    const baseline = this.baseline ?? this.calibrated;
    if (!baseline) return null;
    const threshold = this.calibrated ? this.calibrated.threshold * JUMP_TUNING[this.sensitivity] / JUMP_TUNING.normal : JUMP_TUNING[this.sensitivity];
    return upperHeadTarget(baseline.head, baseline.height, threshold);
  }
  reset(): void { this.last = -Infinity; this.baseline = null; this.rising = false; this.armed = false; this.neutralSince = 0; this.emittedAt = -Infinity; this.landingSince = null; this.previousRise = 0; }
  ingest(points: PoseInput, now: number, ready: boolean): boolean {
    if (!ready || !Number.isFinite(now) || now <= this.last) { this.reset(); return false; }
    const torso = torsoSample(points), head = headSample(points);
    if (!torso || !head) { this.reset(); return false; }
    const sample = { head: head.y, height: torso.height };
    if (now - this.last > 250) { this.baseline = null; this.rising = false; this.armed = false; this.landingSince = null; }
    const elapsed = now - this.last; this.last = now;
    if (!this.baseline) {
      this.baseline = this.calibrated ? { ...this.calibrated } : { ...sample };
      this.neutralSince = now; this.previousRise = 0; return false;
    }
    const b = this.baseline;
    const rise = (b.head - sample.head) / b.height, velocity = (rise - this.previousRise) / (elapsed / 1000);
    this.previousRise = rise;
    if (!this.calibrated && now - this.neutralSince < 150 && Math.abs(rise) > .06) {
      this.baseline = { ...sample }; this.neutralSince = now; this.previousRise = 0; return false;
    }
    const threshold = (b.head - this.targetY!) / b.height;
    const neutral = rise < threshold * .45;
    if (this.rising) {
      if (neutral) {
        this.landingSince ??= now;
        if (now - this.landingSince >= 100 && now - this.emittedAt >= 150) { this.rising = false; this.armed = true; this.neutralSince = now; }
      } else this.landingSince = null;
      return false;
    }
    if (!this.armed) {
      if (!neutral) this.neutralSince = now;
      if (neutral && now - this.neutralSince >= 150) this.armed = true;
    }
    if (this.armed && rise >= threshold && rise < .8 && now - this.neutralSince >= 150 && now - this.emittedAt >= 700) {
      this.rising = true; this.armed = false; this.emittedAt = now; this.landingSince = null; return true;
    }
    // A short crouch must not redefine standing height and turn standing up into a jump.
    if (neutral && Math.abs(rise) < .06 && Math.abs(velocity) < .25 && !this.calibrated) {
      const alpha = 1 - Math.exp(-elapsed / 3500);
      b.head += (sample.head - b.head) * alpha;
      b.height += (sample.height - b.height) * alpha;
    }
    return false;
  }
}
