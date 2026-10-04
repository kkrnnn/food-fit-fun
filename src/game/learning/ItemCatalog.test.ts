import { describe, expect, it } from 'vitest';
import { ITEM_CATALOG, isExercise, createItemLayout } from './ItemCatalog';
import { COURSE_SPEED,GATE_SPACING,QUIZ_APPROACH_DISTANCE } from './RunSession';
describe('mixed single items',()=>{
  it('mixes types, lanes, positions and exercise segments with one item per encounter',()=>{
    const layouts=new Set<string>();const exercisePatterns=new Set<string>();
    for(let seed=0;seed<50;seed++){
      const items=createItemLayout(seed,GATE_SPACING);expect(items).toEqual(createItemLayout(seed,GATE_SPACING));
      expect(new Set(items.map(i=>i.type)).size).toBe(15);expect(items).toHaveLength(100);
      expect(items.filter(i=>ITEM_CATALOG[i.type].category==='occasional')).toHaveLength(60);
      expect(items.filter(i=>!isExercise(i.type) && ITEM_CATALOG[i.type].category==='everyday')).toHaveLength(24);
      expect(items.filter(i=>ITEM_CATALOG[i.type].category==='drink')).toHaveLength(6);
      expect(new Set(items.map(i=>i.distance)).size).toBe(items.length);
      expect(new Set(items.map(i=>i.lane)).size).toBe(3);
      const exercises=items.filter(i=>isExercise(i.type));expect(exercises).toHaveLength(10);
      exercisePatterns.add(exercises.map(i=>Math.floor(i.distance/GATE_SPACING)).join(','));
      exercises.forEach(i=>{const within=i.distance%GATE_SPACING;expect(within/COURSE_SPEED).toBeGreaterThan(3);expect((GATE_SPACING-QUIZ_APPROACH_DISTANCE-within)/COURSE_SPEED).toBeGreaterThan(3);});
      items.forEach((item,index)=>{
        const gate=(Math.floor(item.distance/GATE_SPACING)+1)*GATE_SPACING;expect(gate-item.distance).toBeGreaterThan(QUIZ_APPROACH_DISTANCE);
        if(index)expect((item.distance-items[index-1].distance)/COURSE_SPEED).toBeGreaterThanOrEqual(1);
        expect(item.meal).toBeUndefined();
      });
      layouts.add(JSON.stringify(items));
    }
    expect(layouts.size).toBe(50);expect(exercisePatterns.size).toBeGreaterThan(10);
  });
});
