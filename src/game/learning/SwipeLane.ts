import type { Lane } from './types';

export function swipeJump(dx: number, dy: number, elapsedMs: number): boolean {
  return [dx,dy,elapsedMs].every(Number.isFinite) && elapsedMs >= 0 && elapsedMs <= 800 && dy <= -40 && Math.abs(dy) > Math.abs(dx) * 1.5;
}

/** One deliberate horizontal swipe changes one lane; taps, vertical scroll and long drags do not. */
export function swipeLane(dx: number, dy: number, elapsedMs: number, lane: Lane): Lane | null {
  if (![dx,dy,elapsedMs].every(Number.isFinite) || elapsedMs < 0 || elapsedMs > 800 || Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return Math.max(0,Math.min(2,lane + (dx < 0 ? -1 : 1))) as Lane;
}
