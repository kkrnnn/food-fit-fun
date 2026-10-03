import { describe, expect, it } from 'vitest';
import { TutorialMemory } from './TutorialMemory';
function store(){const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};}
describe('per-player tutorial history',()=>{
  it('persists completion and skip across reload without mixing players',()=>{
    const storage=store();const first=new TutorialMemory(storage);expect(first.has('one')).toBe(false);
    first.finish('one','completed');first.finish('two','skipped');
    const reload=new TutorialMemory(storage);expect(reload.has('one')).toBe(true);expect(reload.has('two')).toBe(true);expect(reload.has('three')).toBe(false);
    // An explicit replay does not erase prior completion when exited early.
    expect(reload.has('one')).toBe(true);reload.clear('one');expect(reload.has('one')).toBe(false);expect(reload.has('two')).toBe(true);
  });
  it('recognizes old history without replaying old lessons',()=>{const storage=store();storage.setItem('food-fit-fun:tutorial:old',JSON.stringify({status:'completed',tutorialVersion:'guided-transitions-v1'}));const m=new TutorialMemory(storage);expect(m.has('old')).toBe(true);expect(m.needsUpgrade('old')).toBe(true);m.finish('old','completed');expect(new TutorialMemory(storage).needsUpgrade('old')).toBe(false);});
  it('remembers completion in the current session even when storage fails',()=>{
    const m=new TutorialMemory({getItem:()=>{throw Error();},setItem:()=>{throw Error();},removeItem:()=>{throw Error();}});
    expect(m.finish('one','completed')).toBe(false);expect(m.has('one')).toBe(true);expect(m.has('new')).toBe(false);
  });
});
