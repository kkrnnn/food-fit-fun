import { RESEARCH_BANK } from './ResearchBank';
import { jumpProgress } from './JumpArc';
import type { Lane, SceneItem, Snapshot } from './types';
export type TutorialStage = 'lane' | 'item' | 'jump' | 'quiz' | 'done';
const targets: Lane[] = [0, 2, 1, 1];
const stops = [12, 52, 92, 132];
const ends = [28, 68, 108, 148];
/** Independent course: no RunSession commands, records or question-deck writes. */
export class GuidedTutorial {
  private index = 0;
  private jumpAge = Infinity;
  constructor(private jumpOnly = false) { if(jumpOnly){this.index=2;this.distance=80;} }
  jump(): boolean { if(!this.valid || this.index!==2 || this.phase!=='waiting' || this.lane!==1)return false;this.jumpAge=0;this.phase='moving';this.releasing=true;return true; }
  private lane: Lane = 1;
  private distance = 0;
  private stable = 0;
  private valid = false;
  private releasing = false;
  private speed = 0;
  private phase: 'approaching' | 'waiting' | 'moving' = 'approaching';
  setLane(lane: Lane, valid = true): void { if (this.lane !== lane || !valid) this.stable = 0; this.lane = lane; this.setControlValid(valid); }
  setControlValid(valid: boolean): void { if(!valid){this.jumpAge=Infinity;if(this.index===2 && this.phase==='moving'){this.phase='waiting';this.releasing=false;}} this.valid=valid;if(!valid)this.stable=0; }
  advance(dt: number, active = true): void {
    if (!active || this.index >= 4 || dt <= 0) { this.speed = 0; return; }
    if (!this.valid) { this.stable = 0; this.speed = 0; return; }
    if(Number.isFinite(this.jumpAge))this.jumpAge+=dt;
    if (this.phase === 'waiting') {
      this.speed = 0;
      if (this.lane === targets[this.index]) this.stable += dt; else this.stable = 0;
      if (this.index !== 2 && this.stable >= .3) { this.phase = 'moving'; this.releasing = true; }
      return;
    }
    if (this.phase === 'moving' && this.index > 0 && this.lane !== targets[this.index]) { this.phase = 'waiting';this.stable=0;this.speed=0;this.releasing=false;return; }
    this.speed = Math.min(6.4, this.speed + dt * 16);
    const limit = this.phase === 'approaching' ? stops[this.index] : ends[this.index];
    const remaining=limit-this.distance;
    if (remaining < 1.3) this.speed=Math.max(.5,Math.min(this.speed,remaining*5));
    this.distance = remaining < .05 ? limit : Math.min(limit, this.distance + this.speed * dt);
    if (this.distance === limit) {
      this.speed = 0; this.stable = 0;
      if (this.phase === 'approaching') this.phase = 'waiting';
      else { this.index++; if(this.jumpOnly && this.index===3)this.index=4; this.releasing = false; this.phase = 'approaching'; }
    }
  }
  view(base: Snapshot) {
    const stage: TutorialStage = ['lane','item','jump','quiz','done'][this.index] as TutorialStage;
    const snapshot = { ...base };
    snapshot.distance = this.distance; snapshot.lane = this.lane;
    snapshot.paused = this.phase === 'waiting' || this.speed === 0;
    snapshot.motionSpeed = this.speed; snapshot.jumpProgress=jumpProgress(this.jumpAge * 1000);
    snapshot.balance = this.distance >= stops[2]+2 ? 4 : this.distance >= ends[1] ? 24 : 28;
    snapshot.simulatedBmi = base.initialBmi * (1 + snapshot.balance * .0025);
    snapshot.characterWidthScale = Math.max(.75, Math.min(1.5, snapshot.simulatedBmi / 18));
    snapshot.phase = stage === 'quiz' ? 'quiz_approach' : 'running';
    snapshot.questionIndex = 0;
    snapshot.approachProgress = 1 - Math.max(0, ends[3] - this.distance) / 96;
    if (stage === 'quiz') snapshot.question = {exposureCount:0,question:RESEARCH_BANK.questions[0],options:RESEARCH_BANK.questions[0].options};
    else snapshot.question = undefined;
    const items: SceneItem[] = stage === 'item' && this.distance < ends[1] ? [{ id:'practice-apple',type:'APPLE',lane:2,distance:ends[1] }] : stage === 'jump' && this.distance<stops[2]+2 ? [{id:'practice-exercise',type:'SHOES',lane:1,distance:stops[2]+2}] : [];
    return { snapshot, items, stage, target: targets[this.index], waiting: this.phase === 'waiting', success: this.releasing, completed: stage === 'done', progress: this.jumpOnly ? (this.index>=4 ? 1 : 0) : this.index, total: this.jumpOnly ? 1 : 4 };
  }
}
