import { describe, expect, it } from 'vitest';
import { RunSession, COURSE_SPEED, GATE_SPACING } from './RunSession';
import { createItemLayout, isExercise } from './ItemCatalog';
import { FOOD_NUTRITION, MEAL_COMPONENTS } from './FoodNutrition';
import { createQuestionSet, DEMO_BANK } from './QuestionDeck';
const makeRun = () => new RunSession({ playerId: 'food', nickname: 'test', version: 1, sex: 'male', ageMonths: 120, heightCm: 140, weightKg: 35, activity: '', avatar: 'mint' }, createQuestionSet(DEMO_BANK, 120, { contentVersion: DEMO_BANK.contentVersion, counts: {} }, 42, true), { runId: 'food', seed: 42, startedAt: '2026-10-04', demo: true, contentVersion: DEMO_BANK.contentVersion, blueprintVersion: DEMO_BANK.blueprintVersion, mode: 'manual' });
import type { ItemType } from './ItemCatalog';
import type { Lane } from './types';
import { pickupLabel } from './PickupLabel';

describe('referenced food portions through gameplay commands', () => {
  it.each(Object.keys(FOOD_NUTRITION) as ItemType[])('adds %s with its real portion and keeps the daily estimate fixed', type => {
    const run: RunSession = makeRun();
    const item = createItemLayout(42, GATE_SPACING).find(i => i.type === type)!;
    expect(item).toBeDefined();
    const gate = Math.floor(item.distance / GATE_SPACING) * GATE_SPACING;
    while (run.snapshot().distance < gate) {
      run.advance(10000);
      const q = run.snapshot().question!;
      run.setLane(q.options.findIndex(o => o.optionId === q.question.correctOptionId) as Lane);
      run.advance(6); run.continueAfterFeedback();
    }
    // Move just before the target; preceding pickups belong to their own portions.
    run.setLane(item.lane); run.advance((item.distance - run.snapshot().distance) / COURSE_SPEED - .01);
    const before = run.snapshot(); run.drainEvents(); run.advance(.02);
    const after = run.snapshot(), food = FOOD_NUTRITION[type]!;
    expect(after.foodIntakeKcal - before.foodIntakeKcal).toBe(food.kcalPerPortion);
    expect(after.dailyEnergyKcal).toBe(before.dailyEnergyKcal);
    expect(after.record.collectedFoods).toContainEqual(expect.objectContaining({ foodId: type, portionLabel: food.portionLabel, kcalPerPortion: food.kcalPerPortion }));
    expect(run.drainEvents()).toEqual([{ kind: 'item', id: item.id, type, deltaKcal: food.kcalPerPortion }]);
    run.advance(.01); expect(run.drainEvents()).toEqual([]);
    expect(after.foodIntakeKcal).toBe(after.record.collectedFoods!.reduce((sum, f) => sum + f.count * f.kcalPerPortion, 0));
  });
  it('has data for every food, no food data for exercise, and an auditable meal recipe', () => {
    const types = new Set(createItemLayout(42, GATE_SPACING).map(i => i.type));
    for (const type of types) {
      if (isExercise(type)) expect(FOOD_NUTRITION[type]).toBeUndefined();
      else expect(FOOD_NUTRITION[type]).toMatchObject({ sourceUrl: expect.stringMatching(/^https:/), verifiedAt: '2026-10-04' });
    }
    expect(MEAL_COMPONENTS.reduce((sum, f) => sum + f.grams * f.kcalPer100g / 100, 0)).toBe(394);
    expect(FOOD_NUTRITION.MEAL!.kcalPerPortion).toBe(394);
  });
  it('labels positive food kcal, zero water and the exercise game deduction', () => {
    expect(pickupLabel('BANANA', 110)).toContain('+110 kcal');
    expect(pickupLabel('WATER', 0)).toContain('0 kcal');
    expect(pickupLabel('WATER', 0)).not.toContain('+');
    expect(pickupLabel('SHOES', -6.733364)).toContain('-6.7 kcal');expect(pickupLabel('SHOES', -6.733364)).toContain('กิจกรรมจำลอง 1 นาที');expect(pickupLabel('SHOES', null)).toContain('ยังไม่มีค่าประมาณ');
  });
});
