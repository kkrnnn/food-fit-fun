import { expect, it } from 'vitest';
import { AdaptiveQuality } from './AdaptiveQuality';
it('reduces sustained slow camera rendering within the chosen ceiling without flapping', () => {
  const budget = new AdaptiveQuality('medium'); let time = 0;
  for (;time<3000;time+=40)budget.observe(40,time,true);
  expect(budget.value.quality).toBe('low');
  for (;time<6500;time+=40)budget.observe(40,time,true);
  expect(budget.value.fps).toBe(30);
  for (;time<9000;time+=16)budget.observe(16,time,true);
  expect(budget.value).toEqual({quality:'low',fps:30});
  expect(budget.observe(100,10000,false)).toEqual({quality:'medium',fps:60});
});
it('ignores menu throttling and isolated long interruptions', () => {
  const budget = new AdaptiveQuality('high');
  for(let time=0;time<10000;time+=100)budget.observe(100,time,false);
  for(let time=10000;time<16000;time+=16)budget.observe(time===12000?500:16,time,true);
  expect(budget.value).toEqual({quality:'high',fps:60});
  budget.reset('low'); expect(budget.value.quality).toBe('low');
});
