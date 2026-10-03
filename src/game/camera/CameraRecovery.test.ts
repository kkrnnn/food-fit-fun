import { describe, expect, it } from 'vitest';
import { CameraRecovery } from './CameraRecovery';
import { PoseMapper, type PoseLandmark } from './PoseMapper';
import { HandHoldStart } from './HandHoldStart';
import { RunSession } from '../learning/RunSession';
import { createQuestionSet, DEMO_BANK } from '../learning/QuestionDeck';

const createRun = () => new RunSession({playerId:'recovery-player',nickname:'test',version:1,sex:'male',ageMonths:120,heightCm:140,weightKg:35,activity:'',avatar:'mint'},createQuestionSet(DEMO_BANK,120,{contentVersion:DEMO_BANK.contentVersion,counts:{}},42,true),{runId:'same-run',startedAt:'2026-10-03',seed:42,demo:true,mode:'camera',contentVersion:DEMO_BANK.contentVersion,blueprintVersion:DEMO_BANK.blueprintVersion});
function pose(raised=false): PoseLandmark[] {
  const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
  p[11]={x:.4,y:.35,visibility:1};p[12]={x:.6,y:.35,visibility:1};
  p[23]={x:.4,y:.75,visibility:1};p[24]={x:.6,y:.75,visibility:1};
  p[15]={x:.4,y:raised?.15:.65,visibility:1};p[16]={x:.6,y:.65,visibility:1};return p;
}
describe('camera recovery on the existing course',()=>{
  it('freezes a question mid-approach and preserves run, score, answers and selection time',()=>{
    const run=createRun(),mapper=new PoseMapper(),hold=new HandHoldStart(),recovery=new CameraRecovery();
    run.setLane(1);run.advance(10000);
    const q=run.snapshot().question!;run.setLane(q.options.findIndex(o=>o.optionId===q.question.correctOptionId) as 0|1|2);run.advance(6);
    run.advance(10000);run.advance(2);const before=run.snapshot();
    expect(before.questionIndex).toBe(1);expect(before.phase).toBe('quiz_approach');
    expect(recovery.request(run,mapper,hold)).toBe(true);
    run.advance(20);const stopped=run.snapshot();
    expect(stopped.paused).toBe(true);expect(stopped.distance).toBe(before.distance);
    expect(stopped.approachProgress).toBe(before.approachProgress);expect(stopped.record.answers).toEqual(before.record.answers);
    expect(stopped.record.runId).toBe(before.record.runId);expect(stopped.record.score).toBe(before.record.score);
    expect(recovery.accept(false)).toBe(false);expect(run.snapshot().paused).toBe(true);
    run.setLane(1);expect(recovery.accept(true)).toBe(true);expect(recovery.accept(true)).toBe(false);
    // Accept starts a UI countdown, never resumes the course immediately.
    run.advance(3);expect(run.snapshot().distance).toBe(before.distance);
    run.resume();run.advance(.5);expect(run.snapshot().distance).toBeGreaterThan(before.distance);
  });
  it('recalibrates once despite repeated loss, then accepts only a fresh hand hold',()=>{
    const run=createRun(),mapper=new PoseMapper(),hold=new HandHoldStart(),recovery=new CameraRecovery();
    for(let t=0;t<=1500;t+=125)mapper.ingest(pose(),t);
    expect(mapper.ingest(pose(),1625).calibrated).toBe(true);run.setLane(1);run.advance(2);
    expect(recovery.request(run,mapper,hold)).toBe(true);
    expect(mapper.ingest(pose(),1750).calibrated).toBe(false);
    for(let t=1875;t<=3250;t+=125){
      expect(recovery.request(run,mapper,hold)).toBe(false);
      mapper.ingest(pose(),t);
    }
    const calibrated=mapper.ingest(pose(),3375);expect(calibrated.calibrated).toBe(true);
    hold.ingest(pose(),3375,true);
    let completed=false;
    for(let t=3500;t<=5000;t+=125)completed=hold.ingest(pose(true),t,true).completed;
    expect(completed).toBe(true);expect(run.snapshot().record.trackingPauseCount).toBe(1);
    expect(recovery.accept(calibrated.calibrated)).toBe(true);
    // A fresh interruption during countdown requires another full calibration/hold cycle.
    expect(recovery.request(run,mapper,hold)).toBe(true);
    expect(mapper.ingest(pose(),5125).calibrated).toBe(false);
    expect(hold.ingest(pose(true),5125,true).armed).toBe(false);
  });
  it('does not reopen a finished run and cancellation clears pending recovery',()=>{
    const run=createRun(),mapper=new PoseMapper(),hold=new HandHoldStart(),recovery=new CameraRecovery();
    recovery.request(run,mapper,hold);recovery.cancel();expect(recovery.active).toBe(false);expect(recovery.accept(true)).toBe(false);
    run.endRun('game_over','three_consecutive_wrong');expect(recovery.request(run,mapper,hold)).toBe(false);
  });
});
