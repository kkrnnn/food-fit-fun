import { describe, expect, it } from 'vitest';
import { RunSession, COURSE_SPEED, GATE_SPACING } from './RunSession';
import { createItemLayout, isExercise } from './ItemCatalog';
import { DEMO_BANK, createQuestionSet, parseBank } from './QuestionDeck';
import type { Profile, Lane } from './types';
const profile: Profile={playerId:'exercise',nickname:'test',version:1,sex:'male',ageMonths:144,heightCm:140,weightKg:40,activity:'',avatar:'mint'};
const make=(ageMonths=144)=>new RunSession({...profile,ageMonths},createQuestionSet(DEMO_BANK,ageMonths,{contentVersion:DEMO_BANK.contentVersion,counts:{}},42,true),{runId:'exercise',startedAt:'2026-10-03',seed:42,demo:true,contentVersion:DEMO_BANK.contentVersion,blueprintVersion:DEMO_BANK.blueprintVersion,mode:'manual'});
function approachExercise(run: RunSession,type?: string){
  const exercise=createItemLayout(42,GATE_SPACING).find(i=>isExercise(i.type) && (!type || i.type===type))!;
  const previousGate=Math.floor(exercise.distance/GATE_SPACING)*GATE_SPACING;
  while(run.snapshot().distance<previousGate){run.advance(10000);const q=run.snapshot().question!;run.setLane(q.options.findIndex(o=>o.optionId===q.question.correctOptionId) as Lane);run.advance(6);run.continueAfterFeedback();}
  run.setLane(exercise.lane);run.advance((exercise.distance-run.snapshot().distance)/COURSE_SPEED-.2);return exercise;
}
describe('exercise collection commands',()=>{
  it.each(['SHOES','DUMBBELL','ROPE'])('requires jump for %s, deducts only once and preserves referenced food intake',type=>{
    const run=make(),item=approachExercise(run,type),before=run.snapshot();run.drainEvents();
    expect(run.jump()).toBe(true);expect(run.jump()).toBe(false);run.advance(.25);
    const after=run.snapshot();expect(after.foodIntakeKcal).toBe(before.foodIntakeKcal);expect(after.record.itemCounts[item.type]).toBe(1);
    expect(after.dailyEnergyKcal).toBe(before.dailyEnergyKcal);
    const expected=type==='SHOES'?105.268083333:type==='DUMBBELL'?42.67625:101.000458333;
    expect(after.exerciseKcal-before.exerciseKcal).toBeCloseTo(expected,5);expect(after.netEnergyKcal!-before.netEnergyKcal!).toBeCloseTo(-expected,5);
    expect(after.record.collectedExercises).toContainEqual(expect.objectContaining({itemType:item.type,count:1,kcalPerPickup:expect.closeTo(expected,5),durationMinutes:15,basis:'gross'}));
    expect(run.drainEvents().filter(e=>e.kind==='item')).toEqual([{kind:'item',id:item.id,type:item.type,deltaKcal:expect.closeTo(-expected,5)}]);expect(run.drainEvents()).toEqual([]);
    expect(after.record.jumpAttempts).toBe(1);
  });
  it('miss is optional and pause cancels an old jump',()=>{
    for(const pause of [false,true]){const run=make(),item=approachExercise(run);const before=run.snapshot();
      if(pause){run.jump();run.pause(true);expect(run.jump()).toBe(false);run.resume();}
      run.advance(.25);expect(run.snapshot().foodIntakeKcal).toBe(before.foodIntakeKcal);expect(run.snapshot().record.itemCounts[item.type]).toBeUndefined();expect(run.snapshot().record.exerciseMissed).toBe(1);expect(run.snapshot().exerciseKcal).toBe(before.exerciseKcal);
    }
  });
  it('collects unsupported exercise without inventing a deduction and exposes incomplete net energy',()=>{
    const run=make(12),item=approachExercise(run);run.drainEvents();run.jump();run.advance(.25);
    const s=run.snapshot();expect(s.record.itemCounts[item.type]).toBe(1);expect(s.exerciseKcal).toBe(0);
    expect(s.record.exerciseEnergyStatus).toBe('unavailable');expect(s.netEnergyKcal).toBeNull();
    expect(run.drainEvents()).toContainEqual({kind:'item',id:item.id,type:item.type,deltaKcal:null});
  });
  it('keeps the initial weight estimate when the profile changes during a run',()=>{
    const changing={...profile};
    const run=new RunSession(changing,createQuestionSet(DEMO_BANK,144,{contentVersion:DEMO_BANK.contentVersion,counts:{}},42,true),{runId:'snapshot',startedAt:'2026-10-04',seed:42,demo:true,contentVersion:DEMO_BANK.contentVersion,blueprintVersion:DEMO_BANK.blueprintVersion,mode:'manual'});
    changing.weightKg=80;
    const item=approachExercise(run,'ROPE');run.drainEvents();run.jump();run.advance(.25);
    expect(run.snapshot().record.collectedExercises).toContainEqual(expect.objectContaining({itemType:item.type,kcalPerPickup:expect.closeTo(101.000458333,5)}));
  });
  it('supports unbounded demo ages and keeps old bank eligibility',()=>{
    const deck={contentVersion:DEMO_BANK.contentVersion,counts:{}};
    for(const age of [0,12,96,720])expect(createQuestionSet(parseBank(DEMO_BANK),age,deck,1,true)).toHaveLength(10);
    const old={...DEMO_BANK,schemaVersion:1,questions:DEMO_BANK.questions.map(q=>({...q,ageRange:[108,156]}))};
    expect(parseBank(old).schemaVersion).toBe(1);expect(()=>createQuestionSet(parseBank(old),720,deck,1,true)).toThrow();
    expect(()=>parseBank({...DEMO_BANK,schemaVersion:1})).toThrow();
  });
});
