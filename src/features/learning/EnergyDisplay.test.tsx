import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EnergyHud, EnergyResult } from './EnergyDisplay';
import { RunSession } from '../../game/learning/RunSession';
import type { Profile } from '../../game/learning/types';
const PROFILE: Profile = { playerId: 'ui', nickname: 'test', version: 1, sex: 'male', ageMonths: 120, heightCm: 140, weightKg: 35, activity: '', avatar: 'mint' };
import { createQuestionSet, DEMO_BANK } from '../../game/learning/QuestionDeck';
import { FOOD_NUTRITION } from '../../game/learning/FoodNutrition';
const make = (age = 120) => new RunSession({ ...PROFILE, ageMonths: age }, createQuestionSet(DEMO_BANK, age, { contentVersion: DEMO_BANK.contentVersion, counts: {} }, 42, true),
  { runId: 'ui', seed: 42, startedAt: '2026-10-04', demo: true, contentVersion: DEMO_BANK.contentVersion, blueprintVersion: DEMO_BANK.blueprintVersion, mode: 'manual' });
describe('energy presentation states', () => {
  it('shows zero intake, a separate assumed daily reference and no BMI', () => {
    const html = renderToStaticMarkup(<EnergyHud snapshot={make().snapshot()} />);
    expect(html).toContain('พลังงานสุทธิในเกม'); expect(html).toContain('0 <em>kcal');
    expect(html).toContain('เป้าต่อวัน'); expect(html).toContain('กิจกรรมน้อย'); expect(html).not.toContain('BMI');
  });
  it('explains unavailable energy while food totals remain usable', () => {
    const html = renderToStaticMarkup(<EnergyHud snapshot={make(24).snapshot()} />);
    expect(html).toContain('ยังไม่รองรับ'); expect(html).toContain('ต่ำกว่า 3 ปี');
  });
  it('uses saved portions in results rather than edited profile/catalog values', () => {
    const run = make(), item = run.visibleItems()[0]; run.setLane(item.lane); run.advance(item.distance / 16);
    const s = run.snapshot(); s.record.collectedFoods![0].portionLabel = 'snapshot portion';
    const html = renderToStaticMarkup(<EnergyResult snapshot={s} />);
    expect(html).toContain('snapshot portion'); expect(html).toContain('ไม่ใช่บันทึกอาหาร'); expect(html).not.toContain('BMI');
  });
  it('shows serving sizes without manufacturer names while preserving saved source labels', () => {
    const s=make().snapshot();
    s.record.collectedFoods=(['BURGER','MILK','PIZZA','COLA','DONUT'] as const).map(foodId=>({foodId,...FOOD_NUTRITION[foodId]!,count:1}));
    const saved=structuredClone(s.record.collectedFoods);
    const html=renderToStaticMarkup(<EnergyResult snapshot={s} />);
    for(const brand of ['McDonald','Freschetta','Coca-Cola','Krispy Kreme'])expect(html).not.toContain(brand);
    expect(html).toContain('แฮมเบอร์เกอร์');expect(html).toContain('148 g');expect(html).toContain('49 g');
    expect(s.record.collectedFoods).toEqual(saved);
  });
  it('shows the modeled exercise minute and an incomplete result for unsupported collected activity', () => {
    const s=make(24).snapshot();
    s.record.collectedExercises=[{itemType:'ROPE',count:1,...s.record.exerciseEstimates!.ROPE!,kcalPerPickup:null}];
    s.netEnergyKcal=null;
    const html=renderToStaticMarkup(<EnergyResult snapshot={s}/>);
    expect(html).toContain('เทียบเท่า 1 นาที');expect(html).toContain('ยังประมาณครบไม่ได้');
    expect(html).toContain('ยังไม่มีค่าประมาณ');expect(html).not.toContain('−0');
  });
});
