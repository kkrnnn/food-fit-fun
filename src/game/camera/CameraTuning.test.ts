import { afterEach, expect, it, vi } from 'vitest';
import { normalizeCameraTuning, readCameraTuning, saveCameraTuning } from './CameraTuning';
afterEach(() => vi.unstubAllGlobals());
it('validates saved choices and falls back when storage is blocked', () => {
  expect(normalizeCameraTuning({ lane: 'gentle', jump: 'invalid' })).toEqual({ lane: 'gentle', jump: 'normal' });
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
  expect(readCameraTuning()).toEqual({ lane: 'normal', jump: 'normal' });
  expect(saveCameraTuning({ lane: 'steady', jump: 'gentle' })).toBe(false);
});
