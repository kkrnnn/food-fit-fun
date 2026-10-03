import type { RunSession } from '../learning/RunSession';
import type { PoseMapper } from './PoseMapper';
import type { HandHoldStart } from './HandHoldStart';

/** One recovery per interruption: calibration first, then a fresh hold and countdown. */
export class CameraRecovery {
  private pending = false;
  get active(): boolean { return this.pending; }
  request(session: RunSession, mapper: PoseMapper, hold: HandHoldStart): boolean {
    if (session.snapshot().phase === 'terminal' || this.pending) return false;
    session.pause(true);
    session.invalidateControl();
    mapper.recalibrate();
    hold.reset();
    this.pending = true;
    return true;
  }
  /** Unlocks the UI countdown; the run stays paused until that countdown finishes. */
  accept(ready: boolean): boolean {
    if (!this.pending || !ready) return false;
    this.pending = false;
    return true;
  }
  cancel(): void { this.pending = false; }
}
