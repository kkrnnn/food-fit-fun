import { describe, expect, it } from 'vitest';
import { RunSession, COURSE_SPEED, GATE_SPACING } from './RunSession';
import { createItemLayout, isExercise } from './ItemCatalog';
import { DEMO_BANK, createQuestionSet, parseBank } from './QuestionDeck';
import type { Profile, Lane } from './types';
const profile: Profile={playerId:'exercise',nickname:'test',version:1,sex:'male',ageMonths:12,heightCm:140,weightKg:35,activity:'',avatar:'mint'};
const make=()=>new RunSession(profile,createQuestionSet(DEMO_BANK,12,{contentVersion:DEMO_BANK.contentVersion,counts:{}},42,true),{runId:'exercise',startedAt:'2026-10-03',seed:42,demo:true,contentVersion:DEMO_BANK.contentVersion,blueprintVersion:DEMO_BANK.blueprintVersion,mode:'manual'});
function approachExercise(run: RunSession){
  const exercise=createItemLayout(42,GATE_SPACING).find(i=>isExercise(i.type))!;
  const previousGate=Math.floor(exercise.distance/GATE_SPACING)*GATE_SPACING;
  while(run.snapshot().distance<previousGate){run.advance(10000);const q=run.snapshot().question!;run.setLane(q.options.findIndex(o=>o.optionId===q.question.correctOptionId) as Lane);run.advance(6);run.continueAfterFeedback();}
  run.setLane(exercise.lane);run.advance((exercise.distance-run.snapshot().distance)/COURSE_SPEED-.2);return exercise;
}
describe('exercise collection commands',()=>{
  it('requires jump, lowers only simulated BMI and emits once',()=>{
    const run=make(),item=approachExercise(run),before=run.snapshot();run.drainEvents();
    expect(run.jump()).toBe(true);expect(run.jump()).toBe(false);run.advance(.25);
    const after=run.snapshot();expect(after.balance).toBe(before.balance-20);expect(after.record.itemCounts[item.type]).toBe(1);
    expect(after.initialBmi).toBe(before.initialBmi);expect(after.simulatedBmi).toBeLessThan(before.simulatedBmi);
    expect(run.drainEvents().filter(e=>e.kind==='item')).toHaveLength(1);expect(run.drainEvents()).toEqual([]);
    expect(after.record.jumpAttempts).toBe(1);
  });
  it('miss is optional and pause cancels an old jump',()=>{
    for(const pause of [false,true]){const run=make(),item=approachExercise(run);const before=run.snapshot();
      if(pause){run.jump();run.pause(true);expect(run.jump()).toBe(false);run.resume();}
      run.advance(.25);expect(run.snapshot().balance).toBe(before.balance);expect(run.snapshot().record.itemCounts[item.type]).toBeUndefined();expect(run.snapshot().record.exerciseMissed).toBe(1);
    }
  });
  it('supports unbounded demo ages and keeps old bank eligibility',()=>{
    const deck={contentVersion:DEMO_BANK.contentVersion,counts:{}};
    for(const age of [0,12,96,720])expect(createQuestionSet(parseBank(DEMO_BANK),age,deck,1,true)).toHaveLength(10);
    const old={...DEMO_BANK,schemaVersion:1,questions:DEMO_BANK.questions.map(q=>({...q,ageRange:[108,156]}))};
    expect(parseBank(old).schemaVersion).toBe(1);expect(()=>createQuestionSet(parseBank(old),720,deck,1,true)).toThrow();
    expect(()=>parseBank({...DEMO_BANK,schemaVersion:1})).toThrow();
  });
});
