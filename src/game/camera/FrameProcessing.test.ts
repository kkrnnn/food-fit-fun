import { describe, expect, it } from 'vitest';
import { inferenceSize, imageLighting } from './FrameProcessing';
describe('camera inference frames', () => {
  it.each([[1280, 720, 480, 270], [480, 640, 360, 480], [640, 480, 480, 360], [320, 240, 320, 240]])('preserves the complete %sx%s image', (width, height, expectedWidth, expectedHeight) => {
    expect(inferenceSize(width, height)).toEqual({ width: expectedWidth, height: expectedHeight });
  });
  it('handles video metadata before the first frame', () => {
    expect(inferenceSize(0, 0)).toEqual({ width: 480, height: 360 });
    expect(inferenceSize(Infinity, NaN)).toEqual({ width: 480, height: 360 });
  });
  it('distinguishes dark and bright samples without treating transparent pixels as black', () => {
    expect(imageLighting(new Uint8ClampedArray([20, 20, 20, 255]))).toBe('dim');
    expect(imageLighting(new Uint8ClampedArray([128, 128, 128, 255]))).toBe('balanced');
    expect(imageLighting(new Uint8ClampedArray([240, 240, 240, 255]))).toBe('bright');
    expect(imageLighting(new Uint8ClampedArray([0, 0, 0, 0, 128, 128, 128, 255]))).toBe('balanced');
  });
});
