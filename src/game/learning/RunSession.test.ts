import { ITEM_CATALOG, itemBalance } from './ItemCatalog';
import { describe, expect, it } from 'vitest';
import { createQuestionSet, DEMO_BANK, parseBank } from './QuestionDeck';
import { RunSession, LEVEL_DISTANCE, GATE_SPACING, COURSE_SPEED, QUIZ_APPROACH_DISTANCE, QUIZ_SECONDS, TARGET_RUN_SECONDS } from './RunSession';
import type { DeckState, Profile, QuestionBank } from './types';

export const PROFILE: Profile = { playerId: 'test-player', nickname: 'ทดสอบ', version: 1, sex: 'male', ageMonths: 120, heightCm: 140, weightKg: 35, activity: 'active', avatar: 'mint' };
export const makeRun = (mode: 'manual' | 'camera' = 'manual', id = 'run-1') => new RunSession(PROFILE, createQuestionSet(DEMO_BANK, 120, { contentVersion: DEMO_BANK.contentVersion, counts: {} }, 42, true), {
  runId: id, startedAt: '2026-10-02T12:00:00Z', seed: 42, demo: true, contentVersion: DEMO_BANK.contentVersion, blueprintVersion: DEMO_BANK.blueprintVersion, mode,
});
export function answer(run: RunSession, correct: boolean) {
  run.advance(10000);
  expect(run.snapshot().phase).toBe('quiz_approach');
  const question = run.snapshot().question!;
  const lane = question.options.findIndex(o => correct ? o.optionId === question.question.correctOptionId : o.optionId !== question.question.correctOptionId);
  run.setLane(lane as 0 | 1 | 2); run.advance(6);
}

describe('learning run through the public commands', () => {
  it('ends on exactly three consecutive wrong answers, with seven unreached and one terminal result', () => {
    const run = makeRun();
    for (let i = 0; i < 3; i++) { answer(run, false); if (i < 2) run.continueAfterFeedback(); }
    const result = run.snapshot().record;
    expect(result.outcome).toBe('game_over'); expect(result.answers).toHaveLength(3);
    expect(result.distance).toBe(GATE_SPACING * 3); expect(result.unreachedCount).toBe(7); expect(result.incorrectCount).toBe(3);
    run.advance(500); run.continueAfterFeedback(); run.endRun('completed', 'finish');
    expect(run.snapshot().record).toEqual(result);
  });
  it('resets streak on correct answers and completes despite three wrong answers spread out', () => {
    const run = makeRun();
    for (const correct of [false, false, true, false, true, true, true, true, true, true]) { answer(run, correct); run.continueAfterFeedback(); }
    run.advance(10000);
    const r = run.snapshot().record;
    expect(r.outcome).toBe('completed'); expect(r.correctCount).toBe(7); expect(r.incorrectCount).toBe(3);
    expect(r.maxWrongStreak).toBe(2); expect(r.distance).toBe(LEVEL_DISTANCE); expect(r.unreachedCount).toBe(0);
  });
  it('prioritizes game-over on question ten ahead of finish', () => {
    const run = makeRun();
    for (let i = 0; i < 10; i++) { answer(run, i < 7); if (i < 9) run.continueAfterFeedback(); }
    expect(run.snapshot().record.outcome).toBe('game_over'); expect(run.snapshot().distance).toBe(LEVEL_DISTANCE);
  });
  it('clamps huge frame steps to one checkpoint; pause freezes course and gate timers', () => {
    const run = makeRun(); run.advance(99999);
    expect(run.snapshot().distance).toBe(GATE_SPACING - QUIZ_APPROACH_DISTANCE); expect(run.snapshot().record.answers).toHaveLength(0);
    run.pause(true); const before = run.snapshot(); run.advance(30);
    expect(run.snapshot().distance).toBe(before.distance); expect(run.snapshot().record.trackingPauseMs).toBe(30000);
    expect(run.snapshot().phase).toBe('quiz_approach');
    run.resume(); run.advance(2); run.pause(); run.advance(50);
    expect(run.snapshot().approachProgress).toBeCloseTo(1/3);
    run.resume(); run.advance(4); expect(run.snapshot().record.answers).toHaveLength(1);
  });
  it('never resolves from invalid/stale camera control and waits for a stable lane', () => {
    const run = makeRun('camera'); run.advance(1000); expect(run.snapshot().distance).toBe(0);
    run.setLane(1); run.advance(1000);
    run.invalidateControl(); run.advance(6);
    expect(run.snapshot().distance).toBe(GATE_SPACING - QUIZ_APPROACH_DISTANCE); expect(run.snapshot().record.answers).toHaveLength(0);
    run.setLane(2); run.advance(5.9); run.setLane(0); run.advance(.1); expect(run.snapshot().record.answers).toHaveLength(0);
    run.advance(.3); expect(run.snapshot().record.answers).toHaveLength(1);
    run.advance(20); expect(run.snapshot().record.answers).toHaveLength(1);
  });
  it('updates item effects once, does not change the real profile, and measures balance by course distance', () => {
    const run = makeRun(); const real = structuredClone(PROFILE);
    const first = run.visibleItems()[0];
    run.setLane(first.lane); run.advance(first.distance / COURSE_SPEED);
    expect(run.snapshot().balance).toBe(itemBalance(0,first.type)); expect(run.snapshot().record.itemCounts[first.type]).toBe(1);
    run.advance(.01); expect(run.snapshot().record.itemCounts[first.type]).toBe(1);
    run.pause(); run.advance(100); expect(run.snapshot().balancedDistance).toBeCloseTo(first.distance + (Math.abs(run.snapshot().balance)<=20 ? COURSE_SPEED*.01 : 0));
    expect(PROFILE).toEqual(real);
  });
  it('emits pickup and answer feedback once even when UI polls snapshots repeatedly',()=>{
    const run=makeRun();const item=run.visibleItems()[0];
    run.setLane(item.lane);run.advance(item.distance/COURSE_SPEED);
    expect(run.drainEvents()).toMatchObject([{kind:'item',id:item.id,type:item.type}]);
    run.snapshot();run.snapshot();run.advance(.01);expect(run.drainEvents()).toEqual([]);
    answer(run,true);expect(run.drainEvents().filter(e=>e.kind==='answer')).toHaveLength(1);
    expect(run.drainEvents()).toEqual([]);
  });
  it('only abandons once, with no answered questions mislabelled as wrong', () => {
    const run = makeRun(); run.advance(1); run.endRun('abandoned', 'player_exit');
    const r = run.snapshot().record;
    expect(r.answers).toHaveLength(0); expect(r.incorrectCount).toBe(0); expect(r.unreachedCount).toBe(10);
    run.endRun('completed','finish'); expect(run.snapshot().record).toEqual(r);
  });
  it('missing a ground item leaves BMI unchanged and emits no penalty',()=>{
    const run=makeRun(),item=run.visibleItems()[0],initial=run.snapshot();
    run.setLane(((item.lane+1)%3) as 0|1|2);run.advance(item.distance/COURSE_SPEED+.01);
    expect(run.snapshot().balance).toBe(initial.balance);expect(run.snapshot().simulatedBmi).toBe(initial.simulatedBmi);expect(run.drainEvents()).toEqual([]);
  });
  it('uses profile BMI for the character and changes only the fictional body on item collection', () => {
    const run = makeRun(); const initial = run.snapshot();
    expect(initial.initialBmi).toBeCloseTo(35 / 1.4 ** 2);
    expect(initial.simulatedBmi).toBe(initial.initialBmi);
    const burger = run.visibleItems()[0];
    run.setLane(burger.lane); run.advance(burger.distance / COURSE_SPEED);
    const changed = run.snapshot();
    expect(changed.initialBmi).toBe(initial.initialBmi);
    expect(changed.simulatedBmi).toBeCloseTo(initial.initialBmi * (1+ITEM_CATALOG[burger.type].magnitude*.0025));
    expect(changed.characterWidthScale).toBeGreaterThan(initial.characterWidthScale);
    expect(PROFILE.weightKg).toBe(35);
    const heavier = new RunSession({ ...PROFILE, weightKg:45 }, initial.record.plannedQuestions, { runId:'heavier',seed:42,startedAt:initial.record.startedAt,demo:true,contentVersion:DEMO_BANK.contentVersion,blueprintVersion:DEMO_BANK.blueprintVersion,mode:'manual' });
    expect(heavier.snapshot().characterWidthScale).toBeGreaterThan(initial.characterWidthScale);
  });
  it('finishes on the tenth answer gate at three minutes without a post-quiz segment', () => {
    const run = makeRun();
    for(let i=0;i<10;i++){
      run.advance(10000);
      const q=run.snapshot().question!;
      run.setLane(q.options.findIndex(o=>o.optionId===q.question.correctOptionId) as 0|1|2);
      run.advance(QUIZ_SECONDS);
    }
    const result=run.snapshot();
    expect(result.phase).toBe('terminal');
    expect(result.record.outcome).toBe('completed');
    expect(result.distance).toBe(LEVEL_DISTANCE);
    expect(result.record.activePlayMs).toBeCloseTo(TARGET_RUN_SECONDS * 1000);
    expect(result.record.answers[9].checkpoint).toBe(LEVEL_DISTANCE);
    expect(run.visibleItems()).toEqual([]);
  });
  it('keeps game scores bounded and labels control-mode changes for comparison', () => {
    const run = makeRun(); run.setInputMode('camera'); run.setInputMode('manual');
    for (let i = 0; i < 10; i++) { answer(run,true); run.continueAfterFeedback(); }
    run.advance(1000);
    const r = run.snapshot().record;
    expect(r.inputModeGroup).toBe('mixed'); expect(r.inputTimeline).toHaveLength(3);
    expect(r.score).toBeGreaterThanOrEqual(1300); expect(r.score).toBeLessThanOrEqual(1500);
  });
});

describe('question deck and import', () => {
  it('is seeded, unique within a run, prioritizes unseen questions, rolls over without in-run duplicates', () => {
    const deck: DeckState = { contentVersion: DEMO_BANK.contentVersion, counts: {} };
    const first = createQuestionSet(DEMO_BANK,120,deck,1,true);
    expect(first).toEqual(createQuestionSet(DEMO_BANK,120,deck,1,true));
    first.forEach(q => { deck.counts[`${q.question.questionId}@1`] = 1; });
    const second = createQuestionSet(DEMO_BANK,120,deck,2,true);
    expect(second.every(q => !first.some(p => p.question.questionId === q.question.questionId))).toBe(true);
    second.slice(0,7).forEach(q => { deck.counts[`${q.question.questionId}@1`] = 1; });
    const rollover = createQuestionSet(DEMO_BANK,120,deck,3,true);
    expect(new Set(rollover.map(q => q.question.questionId)).size).toBe(10);
    expect(rollover.filter(q => q.exposureCount === 1)).toHaveLength(8);
  });
  it('does not consume planned but unshown questions and rejects insufficient eligible content', () => {
    const deck = { contentVersion: DEMO_BANK.contentVersion, counts: {} as Record<string,number> };
    const first = createQuestionSet(DEMO_BANK,120,deck,1,true);
    first.slice(0,3).forEach(q => { deck.counts[`${q.question.questionId}@1`] = 1; });
    const second = createQuestionSet(DEMO_BANK,120,deck,2,true);
    expect(second.every(q => q.exposureCount === 1)).toBe(true);
    expect(() => createQuestionSet(DEMO_BANK,120,deck,1)).toThrow('ไม่ครบ 10');
    expect(() => createQuestionSet({...DEMO_BANK,questions:DEMO_BANK.questions.map(q=>({...q,ageRange:[108,156]}))},200,deck,1,true)).toThrow();
  });
  it('validates imports and does not accept duplicate IDs, broken answers or age ranges', () => {
    expect(parseBank(DEMO_BANK)).toEqual(DEMO_BANK);
    const bad: QuestionBank = structuredClone(DEMO_BANK); bad.questions[1].questionId = bad.questions[0].questionId;
    expect(() => parseBank(bad)).toThrow();
    bad.questions[1].questionId = 'different'; bad.questions[0].correctOptionId = 'missing'; expect(() => parseBank(bad)).toThrow();
    expect(() => parseBank({ ...DEMO_BANK, questions: DEMO_BANK.questions.slice(0,9) })).toThrow();
  });
});
