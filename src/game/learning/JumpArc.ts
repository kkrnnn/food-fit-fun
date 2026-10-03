/** Shared by collision rules, tutorial timing and the Three.js runner. */
export const JUMP_DURATION_MS = 850;
export const JUMP_COOLDOWN_MS = 950;
export const JUMP_PEAK_HEIGHT = 3.4;
export const GROUND_CLEARANCE_HEIGHT = 2.1;
export function jumpProgress(elapsedMs: number): number | undefined {
  return Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs <= JUMP_DURATION_MS ? elapsedMs / JUMP_DURATION_MS : undefined;
}
export function jumpHeight(progress: number | undefined): number {
  return progress === undefined || progress < 0 || progress > 1 ? 0 : Math.sin(progress * Math.PI) * JUMP_PEAK_HEIGHT;
}
