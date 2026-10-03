import { COURSE_VIEW_DISTANCE, GATE_SPACING, QUIZ_APPROACH_DISTANCE } from './RunSession';
import type { Snapshot } from './types';

/** The question banner opens later than the physical gate enters the view. */
export function visibleGateDistance(snapshot: Snapshot): number | null {
  if (!snapshot.question || snapshot.phase === 'terminal') return null;
  // Guided practice uses its own compact course and approach progress.
  if (snapshot.motionSpeed !== undefined) return snapshot.phase === 'quiz_approach' ? QUIZ_APPROACH_DISTANCE * (1 - snapshot.approachProgress) : null;
  const distance = (snapshot.questionIndex + 1) * GATE_SPACING - snapshot.distance;
  return distance >= 0 && distance <= COURSE_VIEW_DISTANCE ? distance : null;
}
