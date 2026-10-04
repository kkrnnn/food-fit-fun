import { describe, expect, it } from 'vitest';
import { GuidedTutorial } from './GuidedTutorial';
import { RunSession } from './RunSession';
import { createQuestionSet, DEMO_BANK } from './QuestionDeck';
const makeRun=()=>new RunSession({playerId:'practice',nickname:'test',version:1,sex:'male',ageMonths:120,heightCm:140,weightKg:35,activity:'',avatar:'mint'},createQuestionSet(DEMO_BANK,120,{contentVersion:DEMO_BANK.contentVersion,counts:{}},42,true),{runId:'practice-base',startedAt:'2026-10-03',seed:42,demo:true,mode:'manual',contentVersion:DEMO_BANK.contentVersion,blueprintVersion:DEMO_BANK.blueprintVersion});
describe('guided pause-and-act course',()=>{
  it('freezes at each instruction, waits for the right lane and never touches the run',()=>{
    const run=makeRun(),base=run.snapshot(),tutorial=new GuidedTutorial();tutorial.setLane(1);
    for(let i=0;i<100;i++)tutorial.advance(.1);
    const waiting=tutorial.view(base);expect(waiting.waiting).toBe(true);
    tutorial.advance(100);expect(tutorial.view(base).snapshot.distance).toBe(waiting.snapshot.distance);
    tutorial.setLane(2);tutorial.advance(10);expect(tutorial.view(base).success).toBe(false);
    tutorial.setLane(0);tutorial.advance(.31);expect(tutorial.view(base).success).toBe(true);
    for(let i=0;i<100;i++)tutorial.advance(.1);
    expect(tutorial.view(base).stage).toBe('item');expect(tutorial.view(base).waiting).toBe(true);
    tutorial.setLane(2);tutorial.advance(.31);
    for(let i=0;i<100;i++)tutorial.advance(.1);
    expect(tutorial.view(base).stage).toBe('jump');expect(tutorial.jump()).toBe(false);
    tutorial.setLane(1);tutorial.advance(1);expect(tutorial.view(base).waiting).toBe(true);expect(tutorial.jump()).toBe(true);
    for(let i=0;i<100;i++)tutorial.advance(.1);
    expect(tutorial.view(base).stage).toBe('quiz');
    tutorial.setLane(1);tutorial.advance(.31);
    for(let i=0;i<100;i++)tutorial.advance(.1);
    expect(tutorial.view(base).completed).toBe(true);expect(run.snapshot()).toEqual(base);
  });
  it('upgrades returning players with only the new jump step',()=>{
    const t=new GuidedTutorial(true),base=makeRun().snapshot();t.setLane(1);for(let i=0;i<60;i++)t.advance(.1);expect(t.view(base).stage).toBe('jump');expect(t.jump()).toBe(true);for(let i=0;i<60;i++)t.advance(.1);expect(t.view(base).completed).toBe(true);expect(t.view(base).snapshot.foodIntakeKcal).toBe(130);expect(t.view(base).snapshot.characterWidthScale).toBe(1);
  });
  it('does not progress from invalid tracking or while the tab is inactive',()=>{
    const tutorial=new GuidedTutorial(),base=makeRun().snapshot();tutorial.setLane(1);
    for(let i=0;i<100;i++)tutorial.advance(.1);
    tutorial.setLane(0,false);tutorial.advance(30);expect(tutorial.view(base).success).toBe(false);
    tutorial.setLane(0);tutorial.advance(30,false);expect(tutorial.view(base).success).toBe(false);
    tutorial.advance(.31);expect(tutorial.view(base).success).toBe(true);
  });
});
