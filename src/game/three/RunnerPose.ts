/** Runner faces -Z: a bent knee rotates negatively, folding the heel back toward +Z. */
export function runnerPose(phase: number) {
  const stride = Math.sin(phase);
  return {
    leftHip: stride * .48,
    rightHip: -stride * .48,
    leftKnee: -.12 - Math.max(0, -stride) * .85,
    rightKnee: -.12 - Math.max(0, stride) * .85,
    leftShoulder: -stride * .38,
    rightShoulder: stride * .38,
    lift: .1 + (1 - Math.cos(phase * 2)) * .022,
    twist: stride * .025,
  };
}
