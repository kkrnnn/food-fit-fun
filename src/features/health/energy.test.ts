import { describe, expect, it } from 'vitest';
import { estimateEnergy, gameBodyWidth } from './energy';
import type { Profile } from '../../game/learning/types';
const profile: Profile = { playerId: 'energy', nickname: 'ทดสอบ', version: 1, sex: 'male', ageMonths: 120,
  agePrecision: 'years', heightCm: 130, weightKg: 30, activity: '', avatar: 'mint' };
describe('daily energy reference', () => {
  it('matches independent DRI examples without rounding the saved estimate', () => {
    expect(estimateEnergy(profile)).toMatchObject({ dailyEnergyKcal: 1700.09, energyStatus: 'available', activityAssumption: 'inactive' });
    expect(estimateEnergy({ ...profile, sex: 'female' }).dailyEnergyKcal).toBeCloseTo(1471.09);
    expect(estimateEnergy({ ...profile, activity: 'very' })).toEqual(estimateEnergy(profile));
  });
  it.each([
    [3, 1669.33, 1611.84], [4, 1668.01, 1589.59], [9, 1696.41, 1493.34],
    [14, 1709.81, 1372.09], [19, 1815.30, 1546.61],
  ])('selects age %s growth/adult equations at the boundary', (age, male, female) => {
    expect(estimateEnergy({ ...profile, ageMonths: age * 12 }).dailyEnergyKcal).toBeCloseTo(male);
    expect(estimateEnergy({ ...profile, ageMonths: age * 12, sex: 'female' }).dailyEnergyKcal).toBeCloseTo(female);
  });
  it('keeps unsupported and invalid inputs unavailable', () => {
    for (const patch of [{ ageMonths: 24 }, { ageMonths: -12 }, { heightCm: NaN }, { weightKg: Infinity }, { heightCm: 0 }]) {
      expect(estimateEnergy({ ...profile, ...patch })).toMatchObject({ energyStatus: 'unavailable', dailyEnergyKcal: null });
    }
  });
});

it('grows the game avatar only above a usable target and caps its silhouette', () => {
  expect(gameBodyWidth(0,1700)).toBe(1);expect(gameBodyWidth(1700,1700)).toBe(1);
  expect(gameBodyWidth(2550,1700)).toBeCloseTo(1.225);
  expect(gameBodyWidth(3400,1700)).toBeCloseTo(1.45);
  expect(gameBodyWidth(20000,1700)).toBe(1.65);
  expect(gameBodyWidth(20000,null)).toBe(1);expect(gameBodyWidth(20000,0)).toBe(1);
});
