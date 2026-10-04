// QA only: accelerated real RunSession commands; no storage, cloud or fabricated totals.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RunSession, COURSE_SPEED, GATE_SPACING } from '../../src/game/learning/RunSession';
import { createItemLayout, isExercise } from '../../src/game/learning/ItemCatalog';
import { createQuestionSet, DEMO_BANK } from '../../src/game/learning/QuestionDeck';
import { EnergyResult } from '../../src/features/learning/EnergyDisplay';
import '../../src/features/learning/LearningGame.css';
import type { Lane } from '../../src/game/learning/types';
const profile={playerId:'qa-only',nickname:'QA',version:1,sex:'male' as const,ageMonths:144,heightCm:140,weightKg:40,activity:'' as const,avatar:'mint' as const};
const run=new RunSession(profile,createQuestionSet(DEMO_BANK,144,{contentVersion:DEMO_BANK.contentVersion,counts:{}},42,true),{runId:'qa-only',seed:42,startedAt:'2026-10-04',demo:true,contentVersion:DEMO_BANK.contentVersion,blueprintVersion:DEMO_BANK.blueprintVersion,mode:'manual'});
for(const item of createItemLayout(42,GATE_SPACING)) {
  const previousGate=Math.floor(item.distance/GATE_SPACING)*GATE_SPACING;
  while(run.snapshot().distance<previousGate) {
    run.advance(10000);const q=run.snapshot().question!;
    run.setLane(q.options.findIndex(o=>o.optionId===q.question.correctOptionId) as Lane);run.advance(6);run.continueAfterFeedback();
  }
  run.setLane(item.lane);run.advance((item.distance-run.snapshot().distance)/COURSE_SPEED-.2);
  if(isExercise(item.type))run.jump();run.advance(.25);
}
run.endRun('abandoned','qa-preview');
createRoot(document.getElementById('root')!).render(<main className="lr-game" style={{overflow:'auto',background:'#eee8f7'}}><section className="lr-card" style={{position:'relative',margin:'24px auto',maxHeight:'none',width:'min(780px,calc(100% - 32px))'}}><p>QA · เด็กชาย 12 ปี · 40 kg · ผ่านคำสั่งเก็บอาหารและกระโดดจริงของ RunSession</p><EnergyResult snapshot={run.snapshot()}/></section></main>);
