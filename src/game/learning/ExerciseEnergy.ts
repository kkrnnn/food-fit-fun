import { isExercise, type ItemType } from './ItemCatalog.js';
import type { Profile } from './types';
import { validateProfile } from '../../features/health/profileValidation.js';

export const EXERCISE_MODEL_VERSION = 'nccor-youth+adult-met-gross-1min-v1';
export const LEGACY_EXERCISE_MODEL_VERSION = 'exercise-game-30kcal-v1';
export const EXERCISE_TYPES = ['SHOES','DUMBBELL','ROPE'] as const;
export interface ExerciseEstimate {
  kcalPerPickup: number | null;
  durationMinutes: 1;
  activityLabel: string;
  activityCode: string;
  metKind: 'METy' | 'MET' | null;
  metValue: number | null;
  sourceUrl: string;
  basis: 'gross';
  estimated: true;
}
const YOUTH_SOURCE = 'https://www.nccor.org/tools-youthcompendium/met-view-all-categories/';
const data = {
  SHOES: {label:'จ็อกกิงตามจังหวะตัวเอง',youthCode:'60140X',youth:[6.8,7.4,7.9,8.4],adultCode:'12020',adult:7.5,adultSource:'https://pacompendium.com/running/'},
  DUMBBELL: {label:'ออกกำลังด้วยดัมเบล',youthCode:'85100X',youth:[3,3,2.9,2.9],adultCode:'02054',adult:3.5,adultSource:'https://pacompendium.com/conditioning-exercise/'},
  ROPE: {label:'กระโดดเชือก',youthCode:'10260X',youth:[6.9,7.1,7.2,7.4],adultCode:'15551',adult:11.8,adultSource:'https://pacompendium.com/sports/'},
} as const;
export function exerciseReference(ageYears: number, type: ItemType): Omit<ExerciseEstimate,'kcalPerPickup'> | null {
  if(!isExercise(type) || !Number.isFinite(ageYears) || ageYears<6 || ageYears>=60)return null;
  const row=data[type as keyof typeof data],youth=ageYears<19;
  const group=ageYears<10?0:ageYears<13?1:ageYears<16?2:3;
  return {durationMinutes:1,activityLabel:row.label,activityCode:youth?row.youthCode:row.adultCode,
    metKind:youth?'METy':'MET',metValue:youth?row.youth[group]:row.adult,
    sourceUrl:youth?YOUTH_SOURCE:row.adultSource,basis:'gross',estimated:true};
}
/** Gross reference cost for one simulated minute; never measures a screen jump. */
export function exerciseKcalForWeight(ageYears: number, sex: Profile['sex'], weightKg: number, type: ItemType): number | null {
  const ref=exerciseReference(ageYears,type);
  if(!ref || !['male','female'].includes(sex) || !Number.isFinite(weightKg) || weightKg<=0)return null;
  const bmrPerMinute=ageYears>=19 ? weightKg/60 : sex==='male'
    ? (ageYears<10?22.706*weightKg+504.3:17.686*weightKg+658.2)/1440
    : (ageYears<10?20.315*weightKg+485.9:13.384*weightKg+692.6)/1440;
  return ref.metValue!*bmrPerMinute;
}
export function estimateExerciseEnergy(profile: Profile) {
  const age=profile.ageMonths/12,errors=validateProfile(profile);
  const available=!errors.length && age>=6 && age<60;
  const reason=available?'':errors.length?errors.join(' · '):'ยังไม่มีค่าประมาณออกกำลังกายสำหรับอายุนี้ (รองรับ 6–59 ปี)';
  const estimates: Partial<Record<ItemType,ExerciseEstimate>>={};
  for(const type of EXERCISE_TYPES) {
    const ref=available?exerciseReference(age,type):null;
    estimates[type]=ref?{...ref,kcalPerPickup:exerciseKcalForWeight(age,profile.sex,profile.weightKg,type)}:
      {durationMinutes:1,activityLabel:data[type].label,activityCode:'',metKind:null,metValue:null,sourceUrl:YOUTH_SOURCE,basis:'gross',estimated:true,kcalPerPickup:null};
  }
  return {exerciseModelVersion:EXERCISE_MODEL_VERSION,exerciseEnergyStatus:available?'available' as const:'unavailable' as const,
    exerciseEnergyReason:reason,exerciseEstimates:estimates};
}
export const exerciseDeduction = (type: ItemType, estimates?: Partial<Record<ItemType,ExerciseEstimate>>): number | null => isExercise(type)?estimates?.[type]?.kcalPerPickup??null:0;
export const netGameEnergy = (foodKcal: number, exerciseKcal = 0, unknown = false): number | null => unknown ? null : foodKcal-exerciseKcal;
export const formatGameKcal = (value: number): string => value.toLocaleString('th-TH',{minimumFractionDigits:0,maximumFractionDigits:1});
