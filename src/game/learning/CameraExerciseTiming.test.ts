import { describe, expect, it } from 'vitest';
import { JumpGesture } from '../camera/JumpGesture';
import type { PoseLandmark } from '../camera/PoseMapper';
import { createItemLayout, isExercise } from './ItemCatalog';
import { DEMO_BANK, createQuestionSet } from './QuestionDeck';
import { COURSE_SPEED, GATE_SPACING, RunSession } from './RunSession';
import type { InputMode, Lane, Profile } from './types';

const profile: Profile = { playerId: 'camera-timing', nickname: 'test', version: 1, sex: 'male', ageMonths: 144, heightCm: 140, weightKg: 40, activity: '', avatar: 'mint' };
function approach(leadSeconds: number, mode: InputMode = 'camera') {
  const run = new RunSession(profile, createQuestionSet(DEMO_BANK, 144, { contentVersion: DEMO_BANK.contentVersion, counts: {} }, 42, true), {
    runId: 'camera-timing', startedAt: '2026-10-04', seed: 42, demo: true, contentVersion: DEMO_BANK.contentVersion, blueprintVersion: DEMO_BANK.blueprintVersion, mode,
  });
  run.setLane(1);
  const item = createItemLayout(42, GATE_SPACING).find(item => isExercise(item.type))!;
  const previousGate = Math.floor(item.distance / GATE_SPACING) * GATE_SPACING;
  while (run.snapshot().distance < previousGate) {
    run.advance(10000);
    const question = run.snapshot().question!;
    run.setLane(question.options.findIndex(option => option.optionId === question.question.correctOptionId) as Lane);
    run.advance(6);
    run.continueAfterFeedback();
  }
  run.setLane(item.lane);
  run.advance((item.distance - run.snapshot().distance) / COURSE_SPEED - leadSeconds);
  run.drainEvents();
  return { run, item };
}
function pose(rise = 0): PoseLandmark[] {
  const points = Array.from({ length: 33 }, () => ({ x: .5, y: .7, visibility: 1, presence: 1 }));
  for (const index of [11, 12]) points[index].y = .4 - rise;
  for (const index of [23, 24]) points[index].y = .7 - rise;
  return points;
}

describe('camera jump to exercise pickup timing', () => {
  it.each([.9, .05])('accepts a physical jump %ss before the item with a 125ms pose delay', lead => {
    const { run, item } = approach(lead);
    const detector = new JumpGesture();
    const now = run.snapshot().record.activePlayMs;
    for (let offset = -500; offset <= 0; offset += 125) expect(detector.ingest(pose(), now + offset, true)).toBe(false);
    // The camera delivers the raised torso on the next pose frame.
    run.advance(.125);
    expect(detector.ingest(pose(.05), now + 125, true)).toBe(true);
    expect(run.jump()).toBe(true);
    run.advance(Math.max(0, lead - .125) + .3);
    expect(run.snapshot().record.itemCounts[item.type]).toBe(1);
    expect(run.drainEvents().filter(event => event.kind === 'item')).toHaveLength(1);
    expect(run.snapshot().record.exerciseMissed ?? 0).toBe(0);
  });
  it('keeps the item visible during grace, then emits exactly one deduction', () => {
    const { run, item } = approach(.05);
    const before = run.snapshot().exerciseKcal;
    run.advance(.1);
    expect(run.visibleItems()).toContainEqual(item);
    run.jump();
    expect(run.visibleItems()).not.toContainEqual(item);
    expect(run.snapshot().exerciseKcal).toBeGreaterThan(before);
    run.advance(1);
    expect(run.snapshot().record.itemCounts[item.type]).toBe(1);
    expect(run.drainEvents().filter(event => event.kind === 'item')).toHaveLength(1);
  });
  it.each(['no jump', 'too late', 'too early', 'wrong lane', 'left the lane', 'paused', 'tracking lost', 'invalid pose', 'switched mode'])('does not award an exercise when %s', scenario => {
    const { run, item } = approach(scenario === 'too early' ? 1.2 : .05);
    if (scenario === 'too early') run.jump();
    if (scenario === 'wrong lane') run.setLane(((item.lane + 1) % 3) as Lane);
    run.advance(scenario === 'too early' ? 1.25 : .1);
    if (scenario === 'paused') { run.pause(); expect(run.jump()).toBe(false); run.resume(); }
    if (scenario === 'tracking lost') { run.invalidateControl(); expect(run.jump()).toBe(false); run.setLane(item.lane); }
    if (scenario === 'invalid pose') { run.setLane(item.lane, false); expect(run.jump()).toBe(false); run.setLane(item.lane); }
    if (scenario === 'left the lane') { run.setLane(((item.lane + 1) % 3) as Lane); run.setLane(item.lane); }
    if (scenario === 'switched mode') run.setInputMode('manual');
    if (scenario === 'too late') run.advance(.201);
    if (scenario !== 'no jump' && scenario !== 'too early') run.jump();
    run.advance(.5);
    expect(run.snapshot().record.itemCounts[item.type]).toBeUndefined();
    expect(run.snapshot().record.exerciseMissed).toBe(1);
    expect(run.drainEvents().filter(event => event.kind === 'item')).toEqual([]);
    expect(run.visibleItems()).not.toContainEqual(item);
  });
  it.each([.016, .125, .5])('preserves the early pickup with %ss simulation frames', step => {
    const { run, item } = approach(.9);
    run.jump();
    let remaining = 1.3;
    while (remaining > 1e-8) { const elapsed = Math.min(remaining, step); run.advance(elapsed); remaining -= elapsed; }
    expect(run.snapshot().record.itemCounts[item.type]).toBe(1);
    expect(run.snapshot().record.exerciseMissed ?? 0).toBe(0);
  });
  it.each([.9, -.075])('keeps the manual collision rule for a jump %ss before the item', lead => {
    const { run, item } = approach(lead, 'manual');
    run.jump();
    run.advance(1.3);
    expect(run.snapshot().record.itemCounts[item.type]).toBeUndefined();
    expect(run.snapshot().record.exerciseMissed).toBe(1);
  });
});
