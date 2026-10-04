export type Quality = 'low' | 'medium' | 'high';
const levels: Quality[] = ['low', 'medium', 'high'];
/** Observe active, visible gameplay only. Intentional menu throttling is never a slow-frame signal. */
export class AdaptiveQuality {
  private samples: number[] = [];
  private since = 0;
  private changedAt = 0;
  private active = false;
  private ceiling: Quality;
  private quality: Quality;
  private fps: 30 | 60 = 60;
  constructor(ceiling: Quality) { this.ceiling = this.quality = ceiling; }
  reset(ceiling: Quality): void { this.ceiling = this.quality = ceiling; this.samples = []; this.since = 0; this.changedAt = 0; this.fps = 60; this.active = false; }
  observe(frameMs: number, now: number, active: boolean): { quality: Quality; fps: 30 | 60 } {
    if (!active) { this.active = false; this.samples = []; this.since = 0; this.quality = this.ceiling; this.fps = 60; return this.value; }
    if (!this.active) { this.active = true; this.since = now; this.changedAt = now; }
    if (frameMs <= 0 || frameMs > 150) { this.samples = []; this.since = now; return this.value; }
    this.samples.push(frameMs);
    if (now - this.since < 2500 || this.samples.length < 45) return this.value;
    const sorted = this.samples.sort((a,b)=>a-b), p90 = sorted[Math.floor(sorted.length*.9)];
    this.samples = []; this.since = now;
    if (p90 > 26 && now - this.changedAt >= 2500) {
      const index = levels.indexOf(this.quality);
      if (index > 0) this.quality = levels[index-1];
      else if (p90 > 38) this.fps = 30;
      this.changedAt = now;
    } else if (p90 < 20 && this.fps === 60 && now - this.changedAt >= 15000 && levels.indexOf(this.quality) < levels.indexOf(this.ceiling)) {
      this.quality = levels[levels.indexOf(this.quality)+1]; this.changedAt = now;
    }
    return this.value;
  }
  get value(): { quality: Quality; fps: 30 | 60 } { return { quality: this.quality, fps: this.fps }; }
}
