import { expect, it } from 'vitest';
import { pickupFeedback } from './PickupFeedback';

it('distinguishes pickup types with no popup content', () => {
  const good = pickupFeedback('APPLE'), caution = pickupFeedback('DONUT'), neutral = pickupFeedback('WATER'), exercise = pickupFeedback('SHOES');
  expect(good.kind).toBe('good'); expect(caution.kind).toBe('caution'); expect(neutral.kind).toBe('neutral');
  expect(exercise.particles).toBeGreaterThan(good.particles);
  expect(new Set([good, caution, neutral, exercise].map(v => v.color)).size).toBe(4);
  for (const feedback of [good, caution, neutral, exercise]) {
    expect(feedback).not.toHaveProperty('label'); expect(feedback).not.toHaveProperty('symbol');
  }
});
