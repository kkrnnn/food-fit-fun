import { describe, expect, it } from 'vitest';
import { CameraCalibration } from './CameraCalibration';
import { JumpGesture } from './JumpGesture';
import { PoseMapper, type PoseLandmark } from './PoseMapper';
function pose(screenX = .5, rise = 0): PoseLandmark[] {
  const points = Array.from({ length: 33 }, () => ({ x: 1-screenX, y: .6, visibility: 1 }));
  points[0].y = .2-rise;
  points[11] = { x: 1-screenX-.1, y: .4-rise, visibility: 1 }; points[12] = { x: 1-screenX+.1, y: .4-rise, visibility: 1 };
  points[23] = { x: 1-screenX-.08, y: .7-rise, visibility: 1 }; points[24] = { x: 1-screenX+.08, y: .7-rise, visibility: 1 };
  return points;
}
function setup() {
  const calibration = new CameraCalibration(), mapper = new PoseMapper(); let time = 0;
  const feed = (x = .5, rise = 0, frames = 1) => { for(let i=0;i<frames;i++){const p=pose(x,rise);calibration.ingest(p,mapper.ingest(p,time),time);time+=100;}return calibration.view; };
  return { calibration, mapper, feed };
}
describe('guided camera calibration', () => {
  it('passes the upper target on the first detected touch without a hold, lowering or second attempt', () => {
    const { calibration, feed } = setup();
    expect(feed(.5,0,18).stage).toBe('left'); expect(calibration.profile).toBeNull();
    expect(feed(.34,0,7).stage).toBe('right');
    expect(feed(.65,0,7).stage).toBe('return');
    expect(feed(.5,0,7).stage).toBe('jump');
    expect(feed(.5,.03).stage).toBe('jump');
    const touched = feed(.5,.05);
    expect(touched.jumpPulse).toBe(true);
    expect(touched.stage).toBe('ready');
    expect(touched.progress).toBe(1);
    expect(calibration.profile?.lanes.center).toBeCloseTo(.5);
    expect(calibration.profile?.lanes.left).toBeCloseTo(.34);
    expect(calibration.profile?.lanes.right).toBeCloseTo(.65);
    expect(calibration.view.completed).toEqual({ center:true,left:true,right:true,jump:true });
    const gameplay = new JumpGesture(); gameplay.setCalibration(calibration.profile!.jump);
    expect(gameplay.targetY).toBe(calibration.view.jumpLine);
    expect(calibration.profile!.jump.threshold).toBe(.15);
    expect(feed(.5,.05).jumpPulse).toBe(false);
    calibration.retryJump(); expect(calibration.view.completed.jump).toBe(false); expect(calibration.view.completed.left).toBe(true); expect(calibration.profile).toBeNull();
    expect(feed(.5,.05).stage).toBe('ready');
  });
  it('does not accept center jitter, wrong zones or interrupted holds as a side calibration', () => {
    const { calibration, mapper, feed } = setup(); feed(.5,0,18);
    feed(.48,0,10); expect(calibration.view.stage).toBe('left');
    feed(.34,0,3); calibration.ingest(null,mapper.tick(3000),3000);
    expect(calibration.view.progress).toBe(0); expect(calibration.profile).toBeNull();
    expect(calibration.view.completed.left).toBe(false);
  });
  it('keeps a finished calibration unconfirmable while the body is missing', () => {
    const { calibration, mapper, feed } = setup(); feed(.5,0,18); feed(.34,0,7); feed(.65,0,7); feed(.5,0,12);
    feed(.5,.05);
    expect(calibration.view.stage).toBe('ready');
    calibration.ingest(null,mapper.tick(10000),10000);
    expect(calibration.view.valid).toBe(false); expect(calibration.view.stage).toBe('ready');
  });
  it('does not pass the target from a shoulder-only movement', () => {
    const { calibration, mapper, feed } = setup(); feed(.5,0,18); feed(.34,0,7); feed(.65,0,7); feed(.5,0,7);
    const bent = pose(); bent[11].y = .35; bent[12].y = .35;
    expect(calibration.ingest(bent,mapper.ingest(bent,3900),3900).completed.jump).toBe(false);
    const touched = pose(.5,.05);
    expect(calibration.ingest(touched,mapper.ingest(touched,4000),4000).completed.jump).toBe(true);
  });
  it('uses the head for the setup marker and immediately passes a head-only target touch', () => {
    const {calibration,mapper,feed}=setup();feed(.5,0,18);feed(.34,0,7);feed(.65,0,7);feed(.5,0,7);
    expect(calibration.view.bodyY).toBeCloseTo(.2);
    const target=calibration.view.jumpLine!;expect(target).toBeLessThan(calibration.view.bodyY!);
    const headUp=pose();headUp[0].y=target-.005;
    const view=calibration.ingest(headUp,mapper.ingest(headUp,3900),3900);
    expect(view.stage).toBe('ready');expect(view.bodyY).toBe(headUp[0].y);expect(view.jumpLine).toBe(target);
  });
  it('waits for a stable visible head even if torso calibration has already completed', () => {
    const {calibration,mapper}=setup();
    for(let time=0;time<=1700;time+=100){const points=pose();points[0].visibility=.1;calibration.ingest(points,mapper.ingest(points,time),time);}
    expect(calibration.view.stage).toBe('center');
    const first=pose();expect(calibration.ingest(first,mapper.ingest(first,1800),1800).stage).toBe('center');
    for(let time=1900;time<=3300;time+=100){const points=pose();calibration.ingest(points,mapper.ingest(points,time),time);}
    expect(calibration.view.stage).toBe('left');
  });
});
it('uses asymmetric calibrated zones and can move directly from left to right', () => {
  const mapper = new PoseMapper();
  for(let time=0;time<=1600;time+=100)mapper.ingest(pose(),time);
  mapper.setLaneCalibration({ center:.5,width:.2,left:.36,right:.7 });
  expect(mapper.laneBoundaries).toEqual([.43,.6]);
  for(let time=1700;time<=2000;time+=100)mapper.ingest(pose(.36),time);
  expect(mapper.ingest(pose(.36),2100).lane).toBe(0);
  let firstChanged: number | undefined;
  for(let time=2200;time<=2500;time+=100){const output=mapper.ingest(pose(.7),time);if(output.laneChanged && firstChanged===undefined)firstChanged=output.lane;}
  expect(firstChanged).toBe(2);
  for(let time=2600;time<=2900;time+=100)mapper.ingest(pose(),time);
  expect(mapper.ingest(pose(),3000).lane).toBe(1);
});
it('rebases validated side ranges when recovering a shifted neutral position', () => {
  const mapper = new PoseMapper();
  for(let time=0;time<=1600;time+=100)mapper.ingest(pose(),time);
  mapper.setLaneCalibration({center:.5,width:.2,left:.36,right:.7}); mapper.recalibrate();
  for(let time=1700;time<=3300;time+=100)mapper.ingest(pose(.6),time);
  const boundaries=mapper.laneBoundaries;
  expect(boundaries[0]).toBeCloseTo(.53);expect(boundaries[1]).toBeCloseTo(.7);
  for(let time=3400;time<=3700;time+=100)mapper.ingest(pose(.46),time);
  expect(mapper.ingest(pose(.46),3800).lane).toBe(0);
});
