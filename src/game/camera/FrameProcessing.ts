export type Lighting = 'dim' | 'balanced' | 'bright';
/** Whole-frame resize: crop/mirror would invalidate lane and overlay coordinates. */
export function inferenceSize(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return { width: 480, height: 360 };
  const scale = Math.min(1, 480 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
/** A lighting hint, not a score for model accuracy. */
export function imageLighting(rgba: Uint8ClampedArray): Lighting {
  let total = 0, count = 0;
  for (let index = 0; index + 3 < rgba.length; index += 4) {
    if (!rgba[index + 3]) continue;
    total += .2126 * rgba[index] + .7152 * rgba[index + 1] + .0722 * rgba[index + 2];
    count++;
  }
  const mean = count ? total / count : 128;
  return mean < 55 ? 'dim' : mean > 220 ? 'bright' : 'balanced';
}
