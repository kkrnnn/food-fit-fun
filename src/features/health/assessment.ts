import type { Profile } from '../../game/learning/types';
import bmiRows from './cdc-bmi.json';

export const HEALTH_VERSION = 'cdc2000-month-bin+DRI2023-9to12-v2';
export const EER_SOURCE = 'https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html';
export const BMI_SOURCE = 'https://www.cdc.gov/growthcharts/cdc-data-files.htm';
export const activityLabels = { inactive: 'กิจกรรมน้อย', low: 'กิจกรรมเล็กน้อย', active: 'มีกิจกรรม', very: 'กิจกรรมมาก' };

export function validateProfile(p: Profile): string[] {
  const errors: string[] = [];
  if (typeof p.playerId !== 'string' || !p.playerId || typeof p.nickname !== 'string' || !p.nickname.trim() || p.nickname.trim().length > 40) errors.push('ใส่ชื่อเล่นหรือรหัสผู้เล่นไม่เกิน 40 ตัวอักษร');
  if (!Number.isInteger(p.version) || p.version < 1) errors.push('เวอร์ชันข้อมูลผู้เล่นไม่ถูกต้อง');
  if (!['male', 'female'].includes(p.sex)) errors.push('เลือกเพศที่ใช้กับสูตร');
  if (!Number.isSafeInteger(p.ageMonths) || p.ageMonths < 0 || (p.agePrecision === 'years' && !Number.isInteger(p.ageMonths / 12))) errors.push('ใส่อายุเป็นปีเต็มที่ไม่ติดลบ');
  if (!Number.isFinite(p.heightCm) || p.heightCm < 80 || p.heightCm > 220) errors.push('ตรวจส่วนสูง ใช้หน่วยเซนติเมตร (80–220)');
  if (!Number.isFinite(p.weightKg) || p.weightKg < 10 || p.weightKg > 200) errors.push('ตรวจน้ำหนัก ใช้หน่วยกิโลกรัม (10–200)');
  if (p.activity && !(p.activity in activityLabels)) errors.push('ตรวจระดับกิจกรรม');
  if (!['mint', 'rose', 'amber'].includes(p.avatar)) errors.push('เลือกตัวละคร');
  return errors;
}

export function assessProfile(p: Profile) {
  const errors = validateProfile(p);
  if (errors.length) return { bmi: null, category: 'ยังคำนวณไม่ได้', eer: null, reason: errors.join(' · '), version: HEALTH_VERSION };
  const bmi = p.weightKg / (p.heightCm / 100) ** 2;
  // CDC half-month row represents the complete integer-month age bin.
  const row = p.agePrecision === 'years' ? undefined : bmiRows.find(r => r.sex === (p.sex === 'male' ? 1 : 2) && r.month === p.ageMonths + 0.5);
  const category = !row ? 'ยังไม่แปลผลตามวัย' : bmi < row.p5 ? 'ต่ำกว่าช่วงอ้างอิงตามวัย'
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
  const start = Math.floor(p.ageMonths / 12) * 12;
  const rows = bmiRows.filter(r => r.sex === (p.sex === 'male' ? 1 : 2) &&
    (p.agePrecision === 'years' ? r.month >= start && r.month < start + 12 : r.month === p.ageMonths + .5));
  if (!rows.length || !Number.isFinite(bmi) || bmi <= 0) return {
    position: 50, color: '#8b849b', label: 'ยังไม่มีช่วงอ้างอิง',
    // Preserve the game gauge's colors without assigning an unsupported health category.
    gradient: 'linear-gradient(90deg,#e14860 0% 20%,#edbd65 20% 35%,#57bf99 35% 65%,#edbd65 65% 80%,#e14860 80% 100%)',
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
  return { position: pct(bmi), color, label,
    gradient: `linear-gradient(90deg,#e14860 0% ${pct(min5)}%,#edbd65 ${pct(max5)}%,#57bf99 ${pct(max5)}% ${pct(min85)}%,#edbd65 ${pct(min85)}% ${pct(min95)}%,#e14860 ${pct(max95)}% 100%)` };
}
