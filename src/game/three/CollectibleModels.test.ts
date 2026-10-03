import { expect, it } from 'vitest';
import { Box3, Vector3, Mesh } from 'three';
import { createCollectibleModel } from './CollectibleModels';
import { ITEM_CATALOG, isExercise, type ItemType } from '../learning/ItemCatalog';
import { GROUND_CLEARANCE_HEIGHT } from '../learning/JumpArc';

it('keeps every ground model below the jump clearance with valid finite geometry', () => {
  for(const type of Object.keys(ITEM_CATALOG) as ItemType[]) {
    const model=createCollectibleModel(type), bounds=new Box3().setFromObject(model), size=bounds.getSize(new Vector3());
    expect(bounds.min.y).toBeCloseTo(.12,5);
    expect(Math.max(size.x,size.z)).toBeLessThanOrEqual(2.00001);
    if(!isExercise(type))expect(bounds.max.y).toBeLessThan(GROUND_CLEARANCE_HEIGHT);
    expect(size.length()).toBeGreaterThan(.5);
    model.traverse(object=>{if(object instanceof Mesh){const positions=object.geometry.getAttribute('position');expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);object.geometry.dispose(); const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose());}});
  }
});
