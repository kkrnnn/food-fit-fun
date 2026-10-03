import { expect, it, vi } from 'vitest';

const { readFileSync } = await vi.importActual<{ readFileSync(path: URL, encoding: 'utf8'): string }>('node:fs');

it('reserves both swipe axes for gameplay so a vertical pan cannot cancel jumping', () => {
  const css = readFileSync(new URL('./LearningGame.css', import.meta.url), 'utf8');
  const rule = css.match(/\.lr-game\.lr-touch-run\s*\{([^}]+)\}/)?.[1];
  // Browser gesture arbitration happens before pointer handlers. Allowing pan-y
  // lets Android claim swipe-up and send pointercancel instead of pointerup.
  expect(rule?.match(/touch-action\s*:\s*([^;}]+)/)?.[1].trim()).toBe('none');
});
