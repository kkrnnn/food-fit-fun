import { expect, it } from 'vitest';
import { estimateExerciseEnergy, exerciseKcalForWeight, EXERCISE_TYPES, formatGameKcal } from './ExerciseEnergy';
import type { Profile } from './types';
const profile:Profile={playerId:'exercise',nickname:'test',version:1,sex:'male',ageMonths:144,heightCm:140,weightKg:40,activity:'',avatar:'mint'};
it('scales independent NCCOR minute estimates into 15-minute game pickups',()=>{
  const estimate=estimateExerciseEnergy(profile);
  expect(estimate.exerciseEstimates.SHOES?.kcalPerPickup).toBeCloseTo(105.268083333,5);
  expect(estimate.exerciseEstimates.DUMBBELL?.kcalPerPickup).toBeCloseTo(42.67625,5);
  expect(estimate.exerciseEstimates.ROPE?.kcalPerPickup).toBeCloseTo(101.000458333,5);
  expect(estimate.exerciseEstimates.ROPE).toMatchObject({durationMinutes:15,metValue:7.1,metKind:'METy',activityCode:'10260X',basis:'gross',estimated:true});
  expect(formatGameKcal(-6.733364)).toBe('-6.7');
});
it.each([[6,6.8],[10,7.4],[13,7.9],[16,8.4],[18,8.4],[19,7.5],[59,7.5]])('uses the correct activity table at age %s',(age,met)=>{
  const e=estimateExerciseEnergy({...profile,ageMonths:age*12});
  expect(e.exerciseEstimates.SHOES?.metValue).toBe(met);
  expect(e.exerciseEstimates.SHOES?.metKind).toBe(age<19?'METy':'MET');
});
it('changes with weight/sex in youth and uses the separate adult equation',()=>{
  expect(exerciseKcalForWeight(12,'female',40,'ROPE')).toBeCloseTo(6.054525,5);
  expect(exerciseKcalForWeight(12,'male',50,'ROPE')).toBeGreaterThan(exerciseKcalForWeight(12,'male',40,'ROPE')!);
  expect(exerciseKcalForWeight(19,'male',70,'SHOES')).toBe(8.75);
  expect(exerciseKcalForWeight(19,'female',70,'DUMBBELL')).toBeCloseTo(4.083333,5);
  expect(exerciseKcalForWeight(59,'male',70,'ROPE')).toBeCloseTo(13.766667,5);
});
it('does not invent zero or adult estimates for unsupported ages/invalid profiles',()=>{
  for(const patch of [{ageMonths:60},{ageMonths:720},{weightKg:NaN}]) {
    const e=estimateExerciseEnergy({...profile,...patch});expect(e.exerciseEnergyStatus).toBe('unavailable');
    for(const type of EXERCISE_TYPES)expect(e.exerciseEstimates[type]?.kcalPerPickup).toBeNull();
  }
});
