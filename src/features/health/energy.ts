import type { Profile } from '../../game/learning/types';
import { validateProfile } from './profileValidation.js';

export const ENERGY_MODEL_VERSION = 'dri2023-inactive-3plus-v1';
export const ENERGY_SOURCE = 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html';
export interface EnergyEstimate {
  dailyEnergyKcal: number | null;
  energyStatus: 'available' | 'unavailable';
  energyReason: string;
  energyModelVersion: string;
  activityAssumption: 'inactive';
}
/** DRI 2023 EER, with an explicit product assumption rather than inferred activity. */
export function estimateEnergy(profile: Profile): EnergyEstimate {
  const result: EnergyEstimate = { dailyEnergyKcal: null, energyStatus: 'unavailable', energyReason: '',
    energyModelVersion: ENERGY_MODEL_VERSION, activityAssumption: 'inactive' };
  const errors = validateProfile(profile);
  if (errors.length) return { ...result, energyReason: errors.join(' · ') };
  const age = profile.ageMonths / 12;
  if (age < 3) return { ...result, energyReason: 'ยังไม่มีสูตรรองรับอายุนี้ (ต่ำกว่า 3 ปี)' };
  const male = profile.sex === 'male';
  const growth = age < 4 ? (male ? 20 : 15) : age < 9 ? 15 : age < 14 ? (male ? 25 : 30) : 20;
  const kcal = age < 19
    ? male ? -447.51 + 3.68 * age + 13.01 * profile.heightCm + 13.15 * profile.weightKg + growth
      : 55.59 - 22.25 * age + 8.43 * profile.heightCm + 17.07 * profile.weightKg + growth
    : male ? 753.07 - 10.83 * age + 6.50 * profile.heightCm + 14.10 * profile.weightKg
      : 584.90 - 7.01 * age + 5.72 * profile.heightCm + 11.71 * profile.weightKg;
  if (!Number.isFinite(kcal) || kcal <= 0) return { ...result, energyReason: 'ข้อมูลนี้อยู่นอกช่วงที่สูตรให้ค่าพลังงานได้' };
  return { ...result, dailyEnergyKcal: kcal, energyStatus: 'available' };
}

export const formatKcal = (value: number): string => Math.round(value).toLocaleString('th-TH');

/** Playful excess-energy animation; this is not a prediction of body weight. */
export function gameBodyWidth(intakeKcal: number, dailyKcal: number | null): number {
  if (dailyKcal === null || !Number.isFinite(dailyKcal) || dailyKcal <= 0 || !Number.isFinite(intakeKcal)) return 1;
  return 1 + Math.min(.65, Math.max(0, intakeKcal / dailyKcal - 1) * .45);
}
