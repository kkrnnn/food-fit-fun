import { expect, it } from 'vitest';
import { manualLane } from './ManualLane';
it('A/D move one lane exactly like arrows, including physical keys on Thai layouts', () => {
  for (const lane of [0,1,2] as const) {
    const left = Math.max(0,lane-1), right = Math.min(2,lane+1);
    expect(manualLane('a','KeyA',lane)).toBe(left);
    expect(manualLane('ArrowLeft','ArrowLeft',lane)).toBe(left);
    expect(manualLane('ฟ','KeyA',lane)).toBe(left);
    expect(manualLane('d','KeyD',lane)).toBe(right);
    expect(manualLane('ArrowRight','ArrowRight',lane)).toBe(right);
    expect(manualLane('ก','KeyD',lane)).toBe(right);
  }
});
it('requires two presses to cross from right to left and ignores S', () => {
  const middle = manualLane('a','KeyA',2)!;
  expect(middle).toBe(1);
  expect(manualLane('a','KeyA',middle)).toBe(0);
  expect(manualLane('s','KeyS',0)).toBeNull();
  expect(manualLane('w','KeyW',1)).toBeNull();
  expect(manualLane('2','Digit2',0)).toBe(1);
});
