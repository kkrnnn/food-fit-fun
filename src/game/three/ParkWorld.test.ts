import { expect, it } from 'vitest';
import { Box3, Mesh } from 'three';
import { createParkBlock } from './ParkWorld';
it('keeps all park scenery outside the curb after geometry batching', () => {
  for(let index=0;index<10;index++)for(const side of [-1,1] as const){
    const block=createParkBlock(index,side),bounds=new Box3().setFromObject(block);
    if(side===1)expect(bounds.min.x).toBeGreaterThan(6.5);
    else expect(bounds.max.x).toBeLessThan(-6.5);
    block.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose());}});
  }
});
