// Local deterministic scene benchmark; never opens a camera or writes player data.
import { GameEngine3D } from '../../src/game/three/GameEngine3D';
import { RunSession } from '../../src/game/learning/RunSession';
import { DEMO_BANK, createQuestionSet } from '../../src/game/learning/QuestionDeck';
import type { Profile } from '../../src/game/learning/types';
const profile: Profile = { playerId: 'qa', nickname: 'QA', version: 1, sex: 'male', ageMonths: 144, heightCm: 145, weightKg: 45, activity: '', avatar: 'mint' };
const engine = new GameEngine3D(document.getElementById('scene')!);
engine.setGraphicsQuality('medium');
let copyBenchmarkMs=0, sceneBenchmarkMs=0;
let session: RunSession, started = 0, last = 0, frames: number[] = [], work: number[] = [], id = 0;
function reset() {
  session = new RunSession(profile, createQuestionSet(DEMO_BANK, 144, { contentVersion: DEMO_BANK.contentVersion, counts: {} }, 42, true), { runId: 'qa', startedAt: '2026-10-04', seed: 42, demo: true, contentVersion: DEMO_BANK.contentVersion, blueprintVersion: DEMO_BANK.blueprintVersion, mode: 'camera' });
  let benchmarkStart=performance.now();for(let i=0;i<1000;i++)session.snapshot();copyBenchmarkMs=performance.now()-benchmarkStart;
  benchmarkStart=performance.now();for(let i=0;i<1000;i++)session.sceneSnapshot();sceneBenchmarkMs=performance.now()-benchmarkStart;
  started = last = 0; frames = []; work = []; document.getElementById('metrics')!.textContent = 'กำลังวัด 12 วินาที…';
  cancelAnimationFrame(id); id = requestAnimationFrame(draw);
}
const percentile = (values: number[], p: number) => [...values].sort((a,b)=>a-b)[Math.min(values.length-1, Math.floor(values.length*p))] ?? 0;
function draw(now: number) {
  if (!started) { started = last = now; }
  const dt = Math.min(.1, (now-last)/1000); last = now;
  const begin = performance.now(); session.setLane(Math.floor((now-started)/1600)%3 as 0|1|2); session.advance(dt);
  engine.renderLearning(session.sceneSnapshot(), session.visibleItems(), dt, 'mint');
  if (now-started > 2000) { frames.push(dt*1000); work.push(performance.now()-begin); }
  if (now-started >= 12000) {
    document.getElementById('metrics')!.textContent = JSON.stringify({ copy1000Ms:+copyBenchmarkMs.toFixed(2), scene1000Ms:+sceneBenchmarkMs.toFixed(2), frames: frames.length, medianFrameMs: +percentile(frames,.5).toFixed(2), p95FrameMs: +percentile(frames,.95).toFixed(2), p95WorkMs: +percentile(work,.95).toFixed(2), over50ms: frames.filter(t=>t>50).length }, null, 2);
    return;
  }
  id = requestAnimationFrame(draw);
}
document.getElementById('restart')!.onclick = reset;
reset();
import.meta.hot?.dispose(()=>{cancelAnimationFrame(id);engine.destroy();});
