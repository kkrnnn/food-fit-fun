import { describe, expect, it } from 'vitest';
import { HandHoldStart } from './HandHoldStart';
import { JumpGesture } from './JumpGesture';
import type { PoseLandmark } from './PoseMapper';
function pose(rise=0, hands=false): PoseLandmark[] {
  const points=Array.from({length:33},()=>({x:.5,y:.7,visibility:1,presence:1}));
  points[0].y=.2-rise;
  for(const i of [11,12])points[i].y=.4-rise;
  for(const i of [23,24])points[i].y=.7-rise;
  for(const i of [15,16])points[i].y=hands?.2:.6;
  return points;
}
describe('head upper-target jump gesture',()=>{
  it('keeps the resting head below a visible fixed target even near the top edge', () => {
    const detector = new JumpGesture(); detector.setCalibration({head:.02,height:.3,threshold:.12});
    const standing = pose(); standing[0].y=.02;
    for(let time=0;time<=500;time+=100)detector.ingest(standing,time,true);
    const target=detector.targetY!; expect(target).toBeGreaterThan(0); expect(target).toBeLessThan(.02);
    const raised=pose();raised[0].y=target-.002;
    expect(detector.ingest(raised,600,true)).toBe(true);
    for(let time=700;time<=2000;time+=100)expect(detector.ingest(raised,time,true)).toBe(false);
    expect(detector.targetY).toBe(target);
  });
  it('rejects missing or low-confidence heads and requires a lower head after recovery', () => {
    const detector = new JumpGesture(); detector.setCalibration({head:.2,height:.3,threshold:.075});
    for(let time=0;time<=500;time+=100)detector.ingest(pose(),time,true);
    const missing = pose(.05); missing[0].visibility=.1;
    expect(detector.ingest(missing,600,true)).toBe(false);
    for(let time=700;time<=1400;time+=100)expect(detector.ingest(pose(.05),time,true)).toBe(false);
    for(let time=1500;time<=2000;time+=100)detector.ingest(pose(),time,true);
    expect(detector.ingest(pose(.05),2100,true)).toBe(true);
  });
  it('accepts a head crossing even when the torso landmarks do not rise together', () => {
    const detector = new JumpGesture();
    for(let time=0;time<=500;time+=100)detector.ingest(pose(),time,true);
    const headUp=pose(); headUp[0].y=.15;
    expect(detector.ingest(headUp,600,true)).toBe(true);
  });
  it('does not jump when the head stays below the target while the torso moves', () => {
    const detector = new JumpGesture();
    for(let time=0;time<=500;time+=100)detector.ingest(pose(),time,true);
    const torsoUp=pose(.05); torsoUp[0].y=.2;
    expect(detector.ingest(torsoUp,600,true)).toBe(false);
  });
  it('does not repeat an upper-target action while held there or after tracking briefly breaks', () => {
    const detector = new JumpGesture(); detector.setCalibration({head:.2,height:.3,threshold:.075});
    for(let time=0;time<=500;time+=100)detector.ingest(pose(),time,true);
    expect(detector.ingest(pose(.04),600,true)).toBe(true);
    for(let time=700;time<4000;time+=100)expect(detector.ingest(pose(.04),time,true)).toBe(false);
    detector.ingest(null,4100,false);
    for(let time=4200;time<5000;time+=100)expect(detector.ingest(pose(.04),time,true)).toBe(false);
    for(let time=5000;time<=5500;time+=100)detector.ingest(pose(),time,true);
    expect(detector.ingest(pose(.04),5600,true)).toBe(true);
  });
  it('does not turn standing back up from a held crouch into a jump', () => {
    const detector = new JumpGesture();
    for (let time = 0; time <= 500; time += 100) detector.ingest(pose(), time, true);
    for (let time = 600; time <= 1100; time += 100) expect(detector.ingest(pose(-.05), time, true)).toBe(false);
    expect(detector.ingest(pose(), 1200, true)).toBe(false);
    expect(detector.ingest(pose(.05), 1300, true)).toBe(true);
  });
  it('allows slowly reaching the upper target, with only one pulse until returning down', () => {
    const detector = new JumpGesture();
    detector.setCalibration({head:.2,height:.3,threshold:.12});
    for (let time = 0; time <= 500; time += 100) detector.ingest(pose(), time, true);
    let pulses=0;
    for (let time = 600; time <= 2500; time += 100) if(detector.ingest(pose((time - 500) * .000025), time, true))pulses++;
    expect(pulses).toBe(1);
  });
  it('recognizes a smaller torso rise with gentle tuning without recognizing still-body jitter', () => {
    const gentle = new JumpGesture('gentle'), normal = new JumpGesture();
    for (const detector of [gentle, normal]) {
      for (let time = 0; time <= 500; time += 125) expect(detector.ingest(pose(.005), time, true)).toBe(false);
    }
    expect(gentle.ingest(pose(.035), 625, true)).toBe(true);
    expect(normal.ingest(pose(.035), 625, true)).toBe(false);
  });
  it('requires a fresh neutral baseline after changing sensitivity', () => {
    const detector = new JumpGesture();
    for (let time = 0; time <= 500; time += 125) detector.ingest(pose(), time, true);
    detector.setSensitivity('gentle');
    expect(detector.ingest(pose(.05), 625, true)).toBe(false);
    detector.ingest(pose(), 750, true);
    for (let time = 875; time <= 1375; time += 125) detector.ingest(pose(), time, true);
    expect(detector.ingest(pose(.05), 1500, true)).toBe(true);
  });
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
