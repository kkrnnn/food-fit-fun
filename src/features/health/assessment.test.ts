import { describe, expect, it } from 'vitest';
import { assessProfile, validateProfile, bmiMeter } from './assessment';
import type { Profile } from '../../game/learning/types';
const p: Profile = { playerId: 'p', nickname: 'test', version: 1, sex: 'male', ageMonths: 120, heightCm: 130, weightKg: 30, activity: 'inactive', avatar: 'mint' };
describe('source-backed health estimates', () => {
  it('calculates raw BMI without adult cutoffs and uses the CDC monthly P5/P85/P95 values', () => {
    expect(assessProfile(p).bmi).toBeCloseTo(17.7514792899, 9);
    // CDC source row male 132.5 months: P5 14.56000917, P85 20.19667437, P95 23.21358351.
    const row = { ...p, ageMonths: 132, heightCm: 100 };
    expect(assessProfile({ ...row, weightKg: 14.56000916 }).category).toBe('ต่ำกว่าช่วงอ้างอิงตามวัย');
    expect(assessProfile({ ...row, weightKg: 14.56000917 }).category).toBe('อยู่ในช่วงอ้างอิงตามวัย');
    expect(assessProfile({ ...row, weightKg: 20.19667437 }).category).toBe('สูงกว่าช่วงอ้างอิงตามวัย');
    expect(assessProfile({ ...row, weightKg: 23.21358351 }).category).toBe('สูงกว่าช่วงอ้างอิงระดับ 95');
  });
  it('does not infer exact-month BMI category from whole-year age', () => {
    expect(assessProfile({ ...p, agePrecision: 'years' }).category).toBe('ยังไม่แปลผลตามวัย');
    expect(assessProfile({ ...p, agePrecision: 'years' }).bmi).toBeCloseTo(17.7514792899);
  });
  it.each([
    ['male','inactive',1700.09], ['male','low',1809.92], ['male','active',1933.21], ['male','very',2086.95],
    ['female','inactive',1471.09], ['female','low',1611.96], ['female','active',1694.35], ['female','very',1894.01],
  ] as const)('matches independently worked DRI 2023 example: %s %s', (sex, activity, expected) => {
    expect(assessProfile({ ...p, sex, activity }).eer).toBeCloseTo(expected, 2);
  });
  it('requires activity for energy and bounds the supported age domain without invented values', () => {
    expect(assessProfile({ ...p, activity: '' }).eer).toBeNull();
    for (const ageMonths of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) expect(assessProfile({ ...p, ageMonths }).bmi).toBeNull();
    expect(validateProfile({ ...p, ageMonths: 155 })).toHaveLength(0);
    for(const ageMonths of [0,12,96,156,720]){expect(assessProfile({...p,ageMonths}).bmi).not.toBeNull();expect(assessProfile({...p,ageMonths}).eer).toBeNull();}
    for (const heightCm of [0,NaN,Infinity]) expect(assessProfile({ ...p, heightCm }).bmi).toBeNull();
  });
});

describe('BMI game meter', () => {
  const year = { ...p, agePrecision: 'years' as const };
  it('starts red for a high BMI even when game item balance is zero', () => {
    expect(bmiMeter(year, 25).color).toBe('#e14860');
    expect(bmiMeter(year, 25).label).toBe('สูงกว่าช่วงอ้างอิงมาก');
    expect(bmiMeter(year, 25).position).toBeGreaterThan(bmiMeter(year, 18).position);
    expect(bmiMeter(year, 18).color).toBe('#249b72');
    expect(bmiMeter(year, 12).color).toBe('#e14860');
  });
  it('keeps uncertain whole-year boundaries amber instead of guessing an exact month', () => {
    // Male age 11: P5 ranges from 14.56000917 to 14.89842805 across its 12 monthly rows.
    const profile = { ...year, ageMonths: 132 };
    expect(bmiMeter(profile, 14.7).color).toBe('#d99424');
    expect(bmiMeter({ ...profile, agePrecision: 'months' }, 14.7).color).toBe('#249b72');
  });
  it('uses age and sex and handles missing references without a green fallback', () => {
    expect(bmiMeter({ ...year, sex: 'female' }, 20).gradient).not.toBe(bmiMeter(year, 20).gradient);
    expect(bmiMeter({ ...year, ageMonths: 20 }, 25).color).toBe('#8b849b');
    const unsupported = bmiMeter({ ...year, ageMonths: 12 }, 25);
    expect(unsupported.label).toBe('ยังไม่มีช่วงอ้างอิง');
    expect(unsupported.gradient).not.toContain('#57bf99');
    expect(bmiMeter(year, NaN).color).toBe('#8b849b');
    expect(bmiMeter(year, 100).position).toBe(100);
  });
  it('covers every whole-year child age for both sexes without adult cutoffs', () => {
    for (const sex of ['male','female'] as const) for (let years = 2; years < 20; years++) {
      const meter = bmiMeter({ sex, ageMonths: years * 12, agePrecision: 'years' }, 18);
      expect(meter.label).not.toBe('ยังไม่มีช่วงอ้างอิง');
      expect(meter.referenceLabel).toContain('ปีเต็ม');
    }
    expect(bmiMeter({ ...year, ageMonths: 239, agePrecision: 'months' }, 25).referenceLabel).toContain('เดือน');
    expect(bmiMeter({ ...year, ageMonths: 240 }, 25).referenceLabel).toContain('ผู้ใหญ่');
  });
  it('uses CDC adult equality boundaries consistently at ages 20 and 70 for both sexes', () => {
    for (const sex of ['male','female'] as const) for (const years of [20,70]) {
      const adult = { sex, ageMonths: years * 12, agePrecision: 'years' as const };
      for (const [bmi, label] of [[18.49,'ต่ำกว่าช่วงอ้างอิง'],[18.5,'อยู่ในช่วงอ้างอิง'],[24.99,'อยู่ในช่วงอ้างอิง'],[25,'สูงกว่าช่วงอ้างอิง'],[29.99,'สูงกว่าช่วงอ้างอิง'],[30,'สูงกว่าช่วงอ้างอิงมาก']] as const) {
        expect(bmiMeter(adult, bmi).label).toBe(label);
      }
      expect(assessProfile({ ...p, ...adult, heightCm: 100, weightKg: 25 }).category).toBe('สูงกว่าช่วงอ้างอิงผู้ใหญ่');
    }
  });
});
