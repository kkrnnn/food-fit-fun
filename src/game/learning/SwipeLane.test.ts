import { expect, it } from 'vitest';
import { swipeLane, swipeJump } from './SwipeLane';
it('deliberate swipes move one lane and stop at the road edge', () => {
  expect(swipeLane(-80,10,250,2)).toBe(1);
  expect(swipeLane(80,-10,250,0)).toBe(1);
  expect(swipeLane(-80,0,250,0)).toBe(0);
  expect(swipeLane(80,0,250,2)).toBe(2);
});
it('ignores taps, vertical scrolling, slow drags and invalid samples', () => {
  for (const [dx,dy,ms] of [[20,0,200],[60,70,200],[100,0,801],[NaN,0,100],[70,0,-1]]) expect(swipeLane(dx,dy,ms,1)).toBeNull();
  expect(swipeLane(40,0,800,1)).toBe(2);
});

 it('keeps upward jumping separate from horizontal lane changes',()=>{
   expect(swipeJump(5,-70,200)).toBe(true);expect(swipeLane(5,-70,200,1)).toBeNull();
   for(const [dx,dy,ms] of [[70,-5,200],[0,70,200],[30,-30,200],[0,-70,900],[0,-70,-1],[NaN,-70,200]])expect(swipeJump(dx,dy,ms)).toBe(false);
 });
