import { describe, expect, it } from 'vitest';
import { HandHoldStart } from './HandHoldStart';
import { JumpGesture } from './JumpGesture';
import type { PoseLandmark } from './PoseMapper';
function pose(rise=0, hands=false): PoseLandmark[] {
  const points=Array.from({length:33},()=>({x:.5,y:.7,visibility:1,presence:1}));
  for(const i of [11,12])points[i].y=.4-rise;
  for(const i of [23,24])points[i].y=.7-rise;
  for(const i of [15,16])points[i].y=hands?.2:.6;
  return points;
}
describe('torso jump gesture',()=>{
  it.each([125,66])('emits once and rearms after landing at %sms frames',step=>{
    const d=new JumpGesture();let now=0;
    for(let i=0;i<5;i++){expect(d.ingest(pose(),now,true)).toBe(false);now+=step;}
    expect(d.ingest(pose(.05),now,true)).toBe(true);now+=step;
    expect(d.ingest(pose(.05),now,true)).toBe(false);now+=step;
    for(let i=0;i<12;i++){expect(d.ingest(pose(),now,true)).toBe(false);now+=step;}
    expect(d.ingest(pose(.05),now,true)).toBe(true);
  });
  it('ignores raised hands, crouches, low confidence and stale frames',()=>{
    const d=new JumpGesture();for(let t=0;t<800;t+=125)expect(d.ingest(pose(0,true),t,true)).toBe(false);
    expect(d.ingest(pose(-.05),875,true)).toBe(false);
    expect(d.ingest(pose(.05),1300,true)).toBe(false);
    const bad=pose(.05);bad[23].visibility=.1;expect(d.ingest(bad,1425,true)).toBe(false);
    expect(d.ingest(pose(.05),1550,false)).toBe(false);
    expect(d.ingest(pose(.05),1675,true)).toBe(false);
  });
  it('keeps hand-hold start independent of torso jumping',()=>{
    const d=new JumpGesture(),hold=new HandHoldStart();let completed=false;
    for(let t=0;t<=2250;t+=125){const points=pose(0,t>=500);expect(d.ingest(points,t,true)).toBe(false);if(hold.ingest(points,t,true).completed)completed=true;}
    expect(completed).toBe(true);
  });
  it('rejects mismatched shoulder and hip motion',()=>{
    const d=new JumpGesture();for(let t=0;t<500;t+=125)d.ingest(pose(),t,true);
    const crouch=pose();crouch[11].y-=.05;crouch[12].y-=.05;
    expect(d.ingest(crouch,500,true)).toBe(false);
  });
});
