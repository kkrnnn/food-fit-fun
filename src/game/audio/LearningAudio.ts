import { renderAmbientBeat } from './AmbientBeat';
export interface AudioPreferences { sfx: number; ambient: number; reducedMotion: boolean }
export type AudioCue = 'confirm' | 'hold' | 'countdown' | 'pickup' | 'treat' | 'correct' | 'wrong' | 'finish' | 'gameover';
const KEY = 'food-fit-fun:audio';
const volume = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : fallback;
export function readAudioPreferences(): AudioPreferences {
  try { const p = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return { sfx:volume(p.sfx,.6),ambient:volume(p.ambient,.2),reducedMotion:typeof p.reducedMotion === 'boolean' ? p.reducedMotion : matchMedia('(prefers-reduced-motion: reduce)').matches }; }
  catch { return { sfx:.6,ambient:.2,reducedMotion:false }; }
}
/** Original synthesized sounds: no downloads, licenses or network dependency. */
export class LearningAudio {
  private context: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private voices = new Set<OscillatorNode>();
  private duckUntil = 0;
  private active = false;
  private lastAmbientTarget = -1;
  private lastPickup = -Infinity;
  constructor(public preferences: AudioPreferences) {}
  get ready() { return this.context?.state === 'running'; }
  async unlock(): Promise<void> {
    try {
      if (!this.context || this.context.state === 'closed') {
        const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return;
        this.context = new Constructor();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this.ambient(this.active);
    } catch { /* Silent play remains available. */ }
  }
  configure(preferences: AudioPreferences): boolean {
    this.preferences = preferences; this.ambient(this.active);
    if (preferences.sfx === 0) this.clearVoices();
    try { localStorage.setItem(KEY,JSON.stringify(preferences)); return true; } catch { return false; }
  }
  cue(cue: AudioCue): void {
    const ctx = this.context;
    if (!ctx || !this.ready || this.preferences.sfx === 0) return;
    if (cue === 'pickup' || cue === 'treat') { if (ctx.currentTime - this.lastPickup < .12) return; this.lastPickup = ctx.currentTime; }
    const notes: Record<AudioCue, number[]> = { confirm:[660],hold:[523,784,1046],countdown:[660],pickup:[784,1046],treat:[330,262],correct:[523,659,784,1046],wrong:[392,294],finish:[523,659,784,1046,1318],gameover:[392,330,262] };
    if (cue === 'correct' || cue === 'wrong') this.duckUntil = ctx.currentTime + 1.2;
    this.ambient(this.active);
    notes[cue].forEach((frequency,index) => {
      if (this.voices.size >= 16) return;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      const at = ctx.currentTime + index * .09;
      osc.type = cue === 'wrong' || cue === 'treat' ? 'triangle' : 'sine'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0,at); gain.gain.linearRampToValueAtTime(this.preferences.sfx * .13,at+.015); gain.gain.exponentialRampToValueAtTime(.001,at+.25);
      osc.connect(gain); gain.connect(ctx.destination); this.voices.add(osc);
      osc.onended = () => { osc.disconnect();gain.disconnect();this.voices.delete(osc); };
      osc.start(at);osc.stop(at+.27);
    });
  }
  ambient(active: boolean): void {
    this.active = active;
    const ctx = this.context; if (!ctx || !this.ready) return;
    if (!this.ambientGain) {
      this.ambientGain = ctx.createGain(); this.ambientGain.gain.value = 0; this.ambientGain.connect(ctx.destination);
      const samples = renderAmbientBeat(ctx.sampleRate);
      const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.getChannelData(0).set(samples);
      const source = ctx.createBufferSource();
      source.buffer = buffer; source.loop = true;
      source.connect(this.ambientGain); source.start();
      this.ambientSource = source;
    }
    const target = active ? this.preferences.ambient * (ctx.currentTime < this.duckUntil ? .14 : .42) : 0;
    if (target !== this.lastAmbientTarget) { this.ambientGain.gain.setTargetAtTime(target,ctx.currentTime,.12);this.lastAmbientTarget=target; }
  }
  quiet(): void { this.ambient(false); this.clearVoices(); }
  private clearVoices(): void { this.voices.forEach(osc => { try { osc.stop(); } catch {} }); this.voices.clear(); }
  destroy(): void { this.quiet(); this.ambientSource?.stop();this.ambientSource?.disconnect();this.ambientSource=null;this.ambientGain?.disconnect();this.ambientGain=null;this.lastAmbientTarget=-1;void this.context?.close();this.context=null; }
}
