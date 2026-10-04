import type { PoseInput } from './PoseMapper';
/** Use one stable head landmark (MediaPipe nose 0); never switch points mid-gesture. */
export function headSample(points: PoseInput): { x: number; y: number } | null {
  const head = points?.[0];
  return head && Number.isFinite(head.x) && Number.isFinite(head.y) && head.x >= 0 && head.x <= 1 && head.y > 0 && head.y <= 1 && (head.visibility ?? 1) >= .6 && (head.presence ?? 1) >= .6 ? { x: head.x, y: head.y } : null;
}
/** Leave the standing head below the line and keep the target inside the camera image. */
export function upperHeadTarget(head: number, height: number, threshold: number): number {
  return head - Math.min(height * threshold, head * .5);
}
