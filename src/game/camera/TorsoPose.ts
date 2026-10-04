import type { PoseInput } from './PoseMapper';
export interface TorsoSample { x: number; shoulder: number; hip: number; height: number; width: number }
/** One coordinate contract for setup overlays, lane selection and jump detection. */
export function torsoSample(points: PoseInput): TorsoSample | null {
  const valid = (index: number) => {
    const p = points?.[index];
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= .6 && (p.presence ?? 1) >= .6 ? p : null;
  };
  const ls = valid(11), rs = valid(12), lh = valid(23), rh = valid(24);
  if (!ls || !rs || !lh || !rh) return null;
  const shoulder = (ls.y + rs.y) / 2, hip = (lh.y + rh.y) / 2;
  const width = Math.abs(ls.x - rs.x), height = hip - shoulder;
  if (height < .06 || hip > 1) return null;
  return { x: ((ls.x + rs.x) * .65 + (lh.x + rh.x) * .35) / 2, shoulder, hip, height, width };
}
