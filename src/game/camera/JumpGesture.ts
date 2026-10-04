import type { PoseInput } from './PoseMapper';
import { JUMP_TUNING, type Sensitivity } from './CameraTuning';
/** Torso rise is independent of wrist-based start gestures. One pulse per landing cycle. */
export class JumpGesture {
  constructor(private sensitivity: Sensitivity = 'normal') {}
  setSensitivity(value: Sensitivity): void { this.sensitivity = value; this.reset(); }
  private last = -Infinity;
  private baseline: { shoulder: number; hip: number; height: number } | null = null;
  private neutralSince = 0;
  private rising = false;
  private emittedAt = -Infinity;
  reset(): void { this.last=-Infinity;this.baseline=null;this.rising=false;this.neutralSince=0;this.emittedAt=-Infinity; }
  ingest(points: PoseInput, now: number, ready: boolean): boolean {
    if (!ready || !Number.isFinite(now) || now <= this.last) { this.reset();return false; }
    if (now-this.last>250) { this.baseline=null;this.rising=false;this.neutralSince=now; }
    this.last=now;
    const valid=(i:number)=>{const p=points?.[i];return p && Number.isFinite(p.y) && (p.visibility??1)>=.6 && (p.presence??1)>=.6 ? p : null;};
    const ls=valid(11),rs=valid(12),lh=valid(23),rh=valid(24);
    if(!ls||!rs||!lh||!rh){this.reset();return false;}
    const shoulder=(ls.y+rs.y)/2,hip=(lh.y+rh.y)/2,height=hip-shoulder;
    if(height<.06){this.reset();return false;}
    if(!this.baseline){this.baseline={shoulder,hip,height};this.neutralSince=now;return false;}
    const b=this.baseline,upS=(b.shoulder-shoulder)/b.height,upH=(b.hip-hip)/b.height;
    const neutral=Math.abs(upS)<.06 && Math.abs(upH)<.06;
    if(this.rising){
      if(neutral && now-this.emittedAt>=150){this.rising=false;this.neutralSince=now;}
      else if(now-this.emittedAt>1200){this.baseline=null;this.rising=false;}
      return false;
    }
    if(upS>=JUMP_TUNING[this.sensitivity] && upH>=JUMP_TUNING[this.sensitivity] && Math.abs(upS-upH)<.10 && Math.abs(height/b.height-1)<.15 && now-this.neutralSince>=150 && now-this.emittedAt>=700){this.rising=true;this.emittedAt=now;return true;}
    if(neutral){b.shoulder=b.shoulder*.98+shoulder*.02;b.hip=b.hip*.98+hip*.02;b.height=b.height*.98+height*.02;}
    else if(upH<-.08 || Math.abs(height/b.height-1)>.15){this.baseline=null;this.neutralSince=now;}
    return false;
  }
}
