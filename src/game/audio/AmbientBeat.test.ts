import { describe, expect, it } from 'vitest';
import { renderAmbientBeat } from './AmbientBeat';

describe('ambient beat audio signal', () => {
  it('loops at four bars of 112 BPM with audible output and clipping headroom', () => {
    const rate = 22050;
    const samples = renderAmbientBeat(rate);
    expect(samples.length / rate).toBeCloseTo(16 * 60 / 112, 4);
    let peak = 0, energy = 0;
    for (const value of samples) {
      expect(Number.isFinite(value)).toBe(true);
      peak = Math.max(peak, Math.abs(value)); energy += value * value;
    }
    expect(peak).toBeLessThan(.9);
    expect(Math.sqrt(energy / samples.length)).toBeGreaterThan(.04);
    // The loop boundary must not introduce a large step/click.
    expect(Math.abs(samples[0] - samples[samples.length - 1])).toBeLessThan(.04);
  });
});
