import { ITEM_CATALOG, isExercise, type ItemType } from './ItemCatalog';

/** Scene particles; the kcal amount appears inside the pickup burst. */
export function pickupFeedback(type: ItemType) {
  if (isExercise(type)) return { kind: 'exercise', color: 0x25dba8, particles: 42 } as const;
  if (ITEM_CATALOG[type].category === 'occasional') return { kind: 'caution', color: 0xff7148, particles: 24 } as const;
  if (ITEM_CATALOG[type].category === 'drink') return { kind: 'neutral', color: 0x68cfff, particles: 16 } as const;
  return { kind: 'good', color: 0x37e997, particles: 32 } as const;
}
