import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { runnerPose } from './RunnerPose';
it('folds both heels backward, never bending a knee forward', () => {
  for (let phase = 0; phase < Math.PI * 2; phase += .1) {
    const pose = runnerPose(phase);
    for (const knee of [pose.leftKnee,pose.rightKnee]) {
      const calf = new Vector3(0,-.45,0).applyAxisAngle(new Vector3(1,0,0),knee);
      expect(calf.z).toBeGreaterThan(0);
      expect(calf.y).toBeGreaterThan(-.45);
    }
    expect(pose.leftHip).toBe(-pose.rightHip);
    expect(pose.leftShoulder).toBe(-pose.rightShoulder);
    expect(pose.leftHip * pose.leftShoulder).toBeLessThanOrEqual(0);
  }
});
