import type { PoseInput, PoseOutput } from './PoseMapper';
import type { JumpCalibration } from './JumpGesture';
import { torsoSample, type TorsoSample } from './TorsoPose';
import { headSample, upperHeadTarget } from './HeadPose';
type SetupSample = TorsoSample & { head: number };
const MIN_HEAD_RISE = .15;
export type CalibrationStage = 'center' | 'left' | 'right' | 'return' | 'jump' | 'ready';
export interface LaneCalibration { center: number; width: number; left: number; right: number }
export interface CalibrationProfile { lanes: LaneCalibration; jump: JumpCalibration }
export interface CalibrationView {
  stage: CalibrationStage; progress: number; position: number | null; bodyY: number | null; jumpLine: number | null; boundaries: [number, number];
  completed: { center: boolean; left: boolean; right: boolean; jump: boolean }; jumpPulse: boolean; valid: boolean;
}
/** Setup owns only pose samples. It never sends commands to a RunSession. */
export class CameraCalibration {
  private stage: CalibrationStage = 'center';
  private center: SetupSample | null = null;
  private left: number | null = null;
  private right: number | null = null;
  private position: number | null = null;
  private bodyY: number | null = null;
  private since: number | null = null;
  private anchor = 0;
  private samples: SetupSample[] = [];
  private progress = 0;
  private last = -Infinity;
  private valid = false;
  private jumpPulse = false;
  private noise = 0;
  reset(): void {
    this.stage = 'center'; this.center = null; this.left = null; this.right = null; this.since = null; this.samples = [];
    this.position = null; this.bodyY = null; this.progress = 0; this.last = -Infinity; this.valid = false; this.noise = 0; this.jumpPulse = false;
  }
  retryJump(): void { if (this.center && ['jump', 'ready'].includes(this.stage)) { this.stage = 'jump'; this.jumpPulse = false; this.since = null; this.progress = 0; } }
  get profile(): CalibrationProfile | null {
    if (this.stage !== 'ready' || !this.center || this.left === null || this.right === null) return null;
    return { lanes: { center: this.center.x, width: this.center.width, left: this.left, right: this.right }, jump: { ...this.center, threshold: Math.max(MIN_HEAD_RISE, this.noise * 3) } };
  }
  get view(): CalibrationView {
    const center = this.center?.x ?? .5, width = this.center?.width ?? .2;
    const boundaries: [number, number] = [this.left !== null ? (this.left + center) / 2 : center - width * .42, this.right !== null ? (this.right + center) / 2 : center + width * .42];
    const jumpLine = this.center && ['jump', 'ready'].includes(this.stage) ? upperHeadTarget(this.center.head, this.center.height, Math.max(MIN_HEAD_RISE, this.noise * 3)) : null;
    return { stage: this.stage, progress: this.progress, position: this.position, bodyY: this.bodyY, jumpLine, boundaries, completed: { center: this.stage !== 'center', left: !['center', 'left'].includes(this.stage), right: ['return', 'jump', 'ready'].includes(this.stage), jump: this.stage === 'ready' }, jumpPulse: this.jumpPulse, valid: this.valid };
  }
  ingest(points: PoseInput, output: PoseOutput, time: number): CalibrationView {
    this.jumpPulse = false;
    const sample = torsoSample(points), head = headSample(points);
    this.valid = !!sample && !!head && sample.width >= .025 && output.trackingValid && !output.trackingLost && Number.isFinite(time) && time > this.last;
    if (!this.valid) { this.since = null; this.samples = []; this.progress = 0; this.position = null; this.bodyY = null; return this.view; }
    if (time - this.last > 250) { this.since = null; this.samples = []; }
    this.last = time;
    const s = { ...sample!, head: head!.y, x: 1 - sample!.x }; this.position = ['jump', 'ready'].includes(this.stage) ? 1-head!.x : s.x;
    this.bodyY = ['jump', 'ready'].includes(this.stage) ? s.head : s.shoulder;
    if (this.stage === 'center') {
      if (output.calibrationProgress === 0) { this.samples = []; this.since = null; }
      if (this.since === null || Math.abs(s.head - this.anchor) > s.height * .06) { this.since = time; this.anchor = s.head; this.samples = []; }
      this.samples.push(s); this.progress = Math.min(output.calibrationProgress, (time - this.since) / 1500);
      if (output.calibrated && time - this.since >= 1500) {
        const mean = (key: keyof SetupSample) => this.samples.reduce((sum, value) => sum + value[key], 0) / this.samples.length;
        this.center = { x: mean('x'), head: mean('head'), shoulder: mean('shoulder'), hip: mean('hip'), height: mean('height'), width: mean('width') };
        this.noise = Math.max(...this.samples.map(value => Math.abs((value.head - this.center!.head) / this.center!.height)));
        this.stage = 'left'; this.samples = []; this.since = null; this.progress = 0;
      }
    } else if (this.stage === 'left' || this.stage === 'right' || this.stage === 'return') {
      const c = this.center!, [leftBoundary, rightBoundary] = this.view.boundaries;
      const inTarget = this.stage === 'left' ? s.x < leftBoundary - .008 : this.stage === 'right' ? s.x > rightBoundary + .008 : Math.abs(s.x - c.x) < c.width * .22;
      const upright = Math.abs((s.hip - c.hip) / c.height) < .15 && Math.abs(s.height / c.height - 1) < .18;
      if (!inTarget || !upright) { this.since = null; this.samples = []; this.progress = 0; }
      else {
        if (this.since === null || Math.abs(s.x - this.anchor) > c.width * .12) { this.since = time; this.anchor = s.x; this.samples = []; }
        this.samples.push(s); this.progress = Math.min(1, (time - this.since) / 450);
        if (this.progress >= 1) {
          const x = this.samples.reduce((sum, value) => sum + value.x, 0) / this.samples.length;
          if (this.stage === 'left') { this.left = x; this.stage = 'right'; }
          else if (this.stage === 'right') { this.right = x; this.stage = 'return'; }
          else { this.stage = 'jump'; this.bodyY = s.head; this.position = 1-head!.x; }
          this.since = null; this.samples = []; this.progress = 0;
        }
      }
    } else if (this.stage === 'jump') {
      const c = this.center!;
      const centered = Math.abs(s.x - c.x) < c.width * .4;
      const rise = (c.head - s.head) / c.height;
      const threshold = (c.head - this.view.jumpLine!) / c.height;
      // Setup checks whether the target can be reached, not the gameplay rearm cycle.
      if (centered && rise >= threshold && rise < .8) {
        this.jumpPulse = true; this.stage = 'ready'; this.progress = 1;
      }
    }
    return this.view;
  }
}
