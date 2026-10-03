import { describe, expect, it } from 'vitest';
import { HandHoldStart } from './HandHoldStart';
import type { PoseLandmark } from './PoseMapper';
function points(left: number | null = .7, right: number | null = .7) {
  const p: PoseLandmark[] = Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));
  p[11]={x:.4,y:.4,visibility:1};p[12]={x:.6,y:.4,visibility:1};p[23]={x:.4,y:.8,visibility:1};p[24]={x:.6,y:.8,visibility:1};
  p[15]={x:.4,y:left ?? .2,visibility:left===null?0:1};p[16]={x:.6,y:right ?? .2,visibility:right===null?0:1};return p;
}
describe('hold to start',()=>{
  it('requires a neutral hand-lower first and emits completion once at 8fps',()=>{
    const h=new HandHoldStart();
    for(let t=0;t<=2000;t+=125)expect(h.ingest(points(.2),t,true).completed).toBe(false);
    h.ingest(points(),2125,true);
    for(let t=2250;t<3750;t+=125)expect(h.ingest(points(.2),t,true).completed).toBe(false);
    expect(h.ingest(points(.2),3750,true).completed).toBe(true);
    expect(h.ingest(points(.2),3875,true).completed).toBe(false);
  });
  it('resets on lowered hand, missing wrist, a stale frame or canceled readiness',()=>{
    const h=new HandHoldStart();h.ingest(points(),0,true);h.ingest(points(.2),125,true);
    h.ingest(points(.2),250,true);expect(h.ingest(points(),375,true).progress).toBe(0);
    h.ingest(points(.2),500,true);expect(h.ingest(points(null),625,true).progress).toBe(0);
    h.ingest(points(.2),750,true);expect(h.tick(1100).progress).toBe(0);
    expect(h.ingest(points(.2),1125,true).armed).toBe(false);
    h.ingest(points(),1250,true);h.ingest(points(.2),1375,true);
    expect(h.ingest(points(.2),1500,false).progress).toBe(0);
  });
  it('starts a new timer when switching hands and rejects low confidence',()=>{
    const h=new HandHoldStart();h.ingest(points(),0,true);h.ingest(points(.2),125,true);
    h.ingest(points(.2),250,true);expect(h.ingest(points(.7,.2),375,true).progress).toBe(0);
    const p=points(.7,.2);p[12].visibility=.1;expect(h.ingest(p,500,true).progress).toBe(0);
  });
});
