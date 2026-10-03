import { afterEach, describe, expect, it, vi } from 'vitest';
import { LearningAudio } from './LearningAudio';
function audioContext(fail=false) {
  const voices: { stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[]=[];
  const param=()=>({value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),setTargetAtTime:vi.fn()});
  const source={loop:false,buffer:null,connect:vi.fn(),start:vi.fn(),stop:vi.fn(),disconnect:vi.fn()};
  const ctx={state:'suspended',currentTime:0,sampleRate:22050,destination:{},createBuffer:vi.fn((channels:number,length:number)=>({getChannelData:()=>new Float32Array(length)})),createBufferSource:vi.fn(()=>source),resume:vi.fn(async()=>{if(fail)throw Error('blocked');ctx.state='running';}),close:vi.fn(async()=>{ctx.state='closed';}),createGain:vi.fn(()=>({gain:param(),connect:vi.fn(),disconnect:vi.fn()})),createOscillator:vi.fn(()=>{const voice={frequency:param(),detune:param(),connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};voices.push(voice);return voice;})};
  vi.stubGlobal('window',{AudioContext:class {constructor(){return ctx;}}});return {ctx,voices,source};
}
afterEach(()=>vi.unstubAllGlobals());
describe('learning audio lifecycle',()=>{
  it('requires unlock, limits pickup spam, mutes and cleans up ambience and voices',async()=>{
    const {ctx,voices,source}=audioContext();const audio=new LearningAudio({sfx:.6,ambient:.2,reducedMotion:false});
    audio.cue('correct');expect(ctx.createOscillator).not.toHaveBeenCalled();
    await audio.unlock();expect(audio.ready).toBe(true);audio.ambient(true);
    expect(source.loop).toBe(true);expect(source.start).toHaveBeenCalledOnce();
    audio.ambient(false);audio.ambient(true);expect(ctx.createBufferSource).toHaveBeenCalledOnce();
    const before=voices.length;audio.cue('pickup');expect(voices.length).toBe(before+2);audio.cue('pickup');expect(voices.length).toBe(before+2);
    audio.configure({sfx:0,ambient:0,reducedMotion:true});audio.cue('correct');expect(voices.length).toBe(before+2);
    audio.destroy();expect(source.stop).toHaveBeenCalledOnce();expect(source.disconnect).toHaveBeenCalledOnce();expect(ctx.close).toHaveBeenCalledOnce();expect(voices.every(v=>v.stop.mock.calls.length>0)).toBe(true);
  });
  it('does not throw or block silent play when the browser rejects audio',async()=>{
    audioContext(true);const audio=new LearningAudio({sfx:.6,ambient:.2,reducedMotion:false});
    await expect(audio.unlock()).resolves.toBeUndefined();expect(audio.ready).toBe(false);expect(()=>audio.cue('correct')).not.toThrow();audio.destroy();
  });
});
