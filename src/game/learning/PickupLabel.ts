import type { ItemType } from './ItemCatalog';
import { ITEM_CATALOG } from './ItemCatalog';
import { FOOD_NUTRITION } from './FoodNutrition';
import { formatGameKcal } from './ExerciseEnergy';
import { formatKcal } from '../../features/health/energy';
export function pickupLabel(type: ItemType, deltaKcal: number | null): string {
  const food = FOOD_NUTRITION[type];
  return food ? `${food.name} · ${food.portionLabel} · ${deltaKcal! > 0 ? '+' : ''}${formatKcal(deltaKcal!)} kcal`
    : deltaKcal===null ? `เก็บ${ITEM_CATALOG[type].name} · ยังไม่มีค่าประมาณ kcal สำหรับอายุนี้` : `เก็บ${ITEM_CATALOG[type].name} · ≈ ${formatGameKcal(deltaKcal)} kcal · กิจกรรมจำลอง 15 นาที`;
}
