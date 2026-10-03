/** Original 112 BPM, four-bar loop. Synthesized locally; no external audio assets. */
export function renderAmbientBeat(sampleRate: number): Float32Array {
  const beat = 60 / 112;
  const length = Math.round(16 * beat * sampleRate);
  const samples = new Float32Array(length);
  let noiseState = 42;
  const noise = () => {
    noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
    return noiseState / 4294967296 * 2 - 1;
  };
  const add = (at: number, duration: number, sound: (time: number) => number) => {
    const start = Math.round(at * sampleRate);
    for (let i = 0; i < Math.ceil(duration * sampleRate); i++) {
      samples[(start + i) % length] += sound(i / sampleRate);
    }
  };
  const roots = [130.81, 110, 87.31, 98];
  const melodies = [[523.25, 659.25, 783.99, 659.25], [440, 523.25, 659.25, 523.25], [349.23, 440, 523.25, 440], [392, 493.88, 587.33, 493.88]];
  for (let bar = 0; bar < 4; bar++) {
    const at = bar * 4 * beat;
    for (const step of [0, 2, 3.5]) {
      let phase = 0;
      add(at + step * beat, .3, time => {
        phase += 2 * Math.PI * (48 + 100 * Math.exp(-time * 35)) / sampleRate;
        return Math.sin(phase) * .34 * Math.exp(-time * 18);
      });
    }
    for (const step of [1, 3]) {
      add(at + step * beat, .16, time => (noise() * .13 + Math.sin(time * 2 * Math.PI * 180) * .045) * Math.exp(-time * 28));
    }
    for (let step = 0; step < 8; step++) {
      let previous = 0;
      add(at + step * beat / 2, .065, time => {
        const next = noise();
        const high = next - previous; previous = next;
        return high * (step % 2 ? .028 : .02) * Math.exp(-time * 65);
      });
    }
    for (const step of [0, 1.5, 2.5, 3.5]) {
      add(at + step * beat, .23, time => Math.sin(time * 2 * Math.PI * roots[bar]) * .15 * Math.min(1, time / .008) * Math.exp(-time * 12));
    }
    for (let step = 0; step < 4; step++) {
      add(at + (step + .5) * beat, .25, time => Math.sin(time * 2 * Math.PI * melodies[bar][step]) * .045 * Math.min(1, time / .012) * Math.exp(-time * 16));
    }
  }
  // Remove DC offset and keep overlap below clipping without a hard limiter.
  const mean = samples.reduce((sum, value) => sum + value, 0) / length;
  for (let i = 0; i < length; i++) samples[i] = Math.tanh((samples[i] - mean) * 1.4);
  return samples;
}
