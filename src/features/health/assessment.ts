import type { Profile } from '../../game/learning/types';
import bmiRows from './cdc-bmi.json';
import { validateProfile } from './profileValidation.js';
export { validateProfile, activityLabels } from './profileValidation.js';

export const HEALTH_VERSION = 'cdc2000-2to19+cdc-adult20+DRI2023-9to12-v3';
export const EER_SOURCE = 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html';
export const BMI_SOURCE = 'https://www.cdc.gov/growthcharts/cdc-data-files.htm';
export const ADULT_BMI_SOURCE = 'https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html';

export function assessProfile(p: Profile) {
  const errors = validateProfile(p);
  if (errors.length) return { bmi: null, category: 'ยังคำนวณไม่ได้', eer: null, reason: errors.join(' · '), version: HEALTH_VERSION };
  const bmi = p.weightKg / (p.heightCm / 100) ** 2;
  // CDC half-month row represents the complete integer-month age bin.
  const row = p.agePrecision === 'years' ? undefined : bmiRows.find(r => r.sex === (p.sex === 'male' ? 1 : 2) && r.month === p.ageMonths + 0.5);
  const category = p.ageMonths >= 240 ? bmi < 18.5 ? 'ต่ำกว่าช่วงอ้างอิงผู้ใหญ่' : bmi < 25 ? 'อยู่ในช่วงอ้างอิงผู้ใหญ่' : bmi < 30 ? 'สูงกว่าช่วงอ้างอิงผู้ใหญ่' : 'สูงกว่าช่วงอ้างอิงผู้ใหญ่มาก'
    : !row ? 'ยังไม่แปลผลตามวัย' : bmi < row.p5 ? 'ต่ำกว่าช่วงอ้างอิงตามวัย'
    : bmi < row.p85 ? 'อยู่ในช่วงอ้างอิงตามวัย' : bmi < row.p95 ? 'สูงกว่าช่วงอ้างอิงตามวัย' : 'สูงกว่าช่วงอ้างอิงระดับ 95';
  const coefficients = p.sex === 'male'
    ? { inactive: [-447.51, 3.68, 13.01, 13.15], low: [19.12, 3.68, 8.62, 20.28], active: [-388.19, 3.68, 12.66, 20.46], very: [-671.75, 3.68, 15.38, 23.25] }
    : { inactive: [55.59, -22.25, 8.43, 17.07], low: [-297.54, -22.25, 12.77, 14.73], active: [-189.55, -22.25, 11.74, 18.34], very: [-709.59, -22.25, 18.22, 14.25] };
  const supportedEnergy = p.ageMonths >= 108 && p.ageMonths < 156;
  const c = p.activity && supportedEnergy ? coefficients[p.activity] : null;
  const eer = c ? c[0] + c[1] * (p.ageMonths / 12) + c[2] * p.heightCm + c[3] * p.weightKg + (p.sex === 'male' ? 25 : 30) : null;
  return { bmi, category, eer: eer !== null && eer > 0 ? eer : null, reason: !supportedEnergy ? 'ยังไม่มีสูตรพลังงานสำหรับอายุนี้ในระบบ' : p.activity ? '' : 'ยังไม่เลือกระดับกิจกรรม จึงยังไม่ประมาณพลังงาน', version: HEALTH_VERSION };
}

/** Game visual reference; whole-year input uses all 12 possible months, never a guessed month. */
export function bmiMeter(p: Pick<Profile, 'sex' | 'ageMonths' | 'agePrecision'>, bmi: number) {
  const valid = Number.isSafeInteger(p.ageMonths) && p.ageMonths >= 0 && ['male', 'female'].includes(p.sex) && Number.isFinite(bmi) && bmi > 0;
  if (valid && p.ageMonths >= 240) {
    const min = 12, max = 40;
    const pct = (value: number) => Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
    return { min, max, position: pct(bmi), color: bmi >= 18.5 && bmi < 25 ? '#249b72' : bmi >= 25 && bmi < 30 ? '#d99424' : '#e14860',
      label: bmi < 18.5 ? 'ต่ำกว่าช่วงอ้างอิง' : bmi < 25 ? 'อยู่ในช่วงอ้างอิง' : bmi < 30 ? 'สูงกว่าช่วงอ้างอิง' : 'สูงกว่าช่วงอ้างอิงมาก',
      referenceLabel: 'เกณฑ์ผู้ใหญ่ 20 ปีขึ้นไป · CDC',
      gradient: `linear-gradient(90deg,#e14860 0% ${pct(18.5)}%,#57bf99 ${pct(18.5)}% ${pct(25)}%,#edbd65 ${pct(25)}% ${pct(30)}%,#e14860 ${pct(30)}% 100%)` };
  }
  const start = Math.floor(p.ageMonths / 12) * 12;
  const rows = bmiRows.filter(r => r.sex === (p.sex === 'male' ? 1 : 2) &&
    (p.agePrecision === 'years' ? r.month >= start && r.month < start + 12 : r.month === p.ageMonths + .5));
  if (!valid || !rows.length) return {
    min: 0, max: 40,
    position: 50, color: '#8b849b', label: 'ยังไม่มีช่วงอ้างอิง',
    referenceLabel: valid && p.ageMonths < 24 ? 'อายุต่ำกว่า 2 ปี · ไม่แปลผล BMI' : 'ตรวจอายุ เพศ และค่า BMI',
    gradient: 'linear-gradient(90deg,#d3cfda,#d3cfda)',
  };
  const min5 = Math.min(...rows.map(r => r.p5)), max5 = Math.max(...rows.map(r => r.p5));
  const min85 = Math.min(...rows.map(r => r.p85)), max85 = Math.max(...rows.map(r => r.p85));
  const min95 = Math.min(...rows.map(r => r.p95)), max95 = Math.max(...rows.map(r => r.p95));
  const low = min5 - 4, high = max95 + 8;
  const pct = (value: number) => Math.max(0, Math.min(100, (value - low) / (high - low) * 100));
  const healthy = bmi >= max5 && bmi < min85;
  const extreme = bmi < min5 || bmi >= max95;
  const elevated = bmi >= max85;
  const color = healthy ? '#249b72' : extreme ? '#e14860' : '#d99424';
  const label = healthy ? 'อยู่ในช่วงอ้างอิง' : bmi < min5 ? 'ต่ำกว่าช่วงอ้างอิง'
    : bmi >= max95 ? 'สูงกว่าช่วงอ้างอิงมาก' : elevated ? 'สูงกว่าช่วงอ้างอิง' : 'ใกล้ขอบช่วงอ้างอิง';
  return { min: low, max: high, position: pct(bmi), color, label,
    referenceLabel: p.agePrecision === 'years' ? 'เทียบอายุและเพศ · ปีเต็มเป็นช่วงประมาณ · CDC' : 'เทียบอายุเป็นเดือนและเพศ · CDC',
    gradient: `linear-gradient(90deg,#e14860 0% ${pct(min5)}%,#edbd65 ${pct(max5)}%,#57bf99 ${pct(max5)}% ${pct(min85)}%,#edbd65 ${pct(min85)}% ${pct(min95)}%,#e14860 ${pct(max95)}% 100%)` };
}
