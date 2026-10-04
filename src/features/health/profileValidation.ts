import type { Profile } from '../../game/learning/types';

export const activityLabels = { inactive: 'กิจกรรมน้อย', low: 'กิจกรรมเล็กน้อย', active: 'มีกิจกรรม', very: 'กิจกรรมมาก' };

/** Shared validation without loading browser-only BMI reference data into the API. */
export function validateProfile(p: Profile): string[] {
  const errors: string[] = [];
  if (typeof p.playerId !== 'string' || !p.playerId || typeof p.nickname !== 'string' || !p.nickname.trim() || p.nickname.trim().length > 40) errors.push('ใส่ชื่อเล่นไม่เกิน 40 ตัวอักษร');
  if (!Number.isInteger(p.version) || p.version < 1) errors.push('เวอร์ชันข้อมูลผู้เล่นไม่ถูกต้อง');
  if (!['male', 'female'].includes(p.sex)) errors.push('เลือกเพศ');
  if (!Number.isSafeInteger(p.ageMonths) || p.ageMonths < 0 || (p.agePrecision === 'years' && !Number.isInteger(p.ageMonths / 12))) errors.push('ใส่อายุเป็นปีเต็มที่ไม่ติดลบ');
  if (!Number.isFinite(p.heightCm) || p.heightCm < 80 || p.heightCm > 220) errors.push('ตรวจส่วนสูง ใช้หน่วยเซนติเมตร (80–220)');
  if (!Number.isFinite(p.weightKg) || p.weightKg < 10 || p.weightKg > 200) errors.push('ตรวจน้ำหนัก ใช้หน่วยกิโลกรัม (10–200)');
  if (p.activity && !(p.activity in activityLabels)) errors.push('ตรวจระดับกิจกรรม');
  if (!['mint', 'rose', 'amber'].includes(p.avatar)) errors.push('เลือกตัวละคร');
  return errors;
}
