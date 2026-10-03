import type { Lane } from './types';

/** Physical A/D keys move one lane like arrow keys, including with a Thai keyboard layout. */
export function manualLane(key: string, code: string, current: Lane): Lane | null {
  const letter = key.toLowerCase();
  if (key === 'ArrowLeft' || code === 'KeyA' || letter === 'a') return Math.max(0, current - 1) as Lane;
  if (key === 'ArrowRight' || code === 'KeyD' || letter === 'd') return Math.min(2, current + 1) as Lane;
  if (['1','2','3'].includes(key)) return (Number(key) - 1) as Lane;
  return null;
}
