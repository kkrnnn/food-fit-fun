import { ITEM_CATALOG, isExercise, type ItemType } from './ItemCatalog';

/** Color/motion only: pickup feedback never adds a badge, text or BMI deltas. */
export function pickupFeedback(type: ItemType) {
  if (isExercise(type)) return { kind: 'exercise', color: 0x25dba8, particles: 42 } as const;
  if (ITEM_CATALOG[type].effect === 'increase') return { kind: 'caution', color: 0xff7148, particles: 24 } as const;
  if (ITEM_CATALOG[type].effect === 'neutral') return { kind: 'neutral', color: 0x68cfff, particles: 16 } as const;
  return { kind: 'good', color: 0x37e997, particles: 32 } as const;
}
