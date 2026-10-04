// Local rendering fixture: actual renderer, no camera or persistence.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameEngine3D } from '../../src/game/three/GameEngine3D';
import { RunSession } from '../../src/game/learning/RunSession';
import { DEMO_BANK, createQuestionSet } from '../../src/game/learning/QuestionDeck';
import type { InputMode, Profile, SceneItem } from '../../src/game/learning/types';
const profile: Profile = {playerId:'qa',nickname:'QA',version:1,sex:'male',ageMonths:144,heightCm:145,weightKg:45,activity:'',avatar:'mint'};
function snapshot(mode: InputMode) {
  return new RunSession(profile,createQuestionSet(DEMO_BANK,144,{contentVersion:DEMO_BANK.contentVersion,counts:{}},42,true),{runId:'qa',startedAt:'2026-10-04',seed:42,demo:true,contentVersion:DEMO_BANK.contentVersion,blueprintVersion:DEMO_BANK.blueprintVersion,mode}).snapshot();
}
const items: SceneItem[] = [
  {id:'banana',type:'BANANA',lane:0,distance:15}, {id:'meal',type:'MEAL',lane:1,distance:15}, {id:'vegetable',type:'BROCCOLI',lane:2,distance:15},
  {id:'shoes',type:'SHOES',lane:0,distance:26}, {id:'dumbbell',type:'DUMBBELL',lane:1,distance:26}, {id:'rope',type:'ROPE',lane:2,distance:26},
];
function Preview() {
  const host=useRef<HTMLDivElement>(null), frame=useRef(snapshot('camera'));
  const [mode,setMode]=useState<InputMode>('camera');
  useEffect(()=>{
    const engine=new GameEngine3D(host.current!); engine.setGraphicsQuality('medium');let id=0;
    const draw=()=>{engine.renderLearning(frame.current,items,.016,'mint');id=requestAnimationFrame(draw);};draw();
    return()=>{cancelAnimationFrame(id);engine.destroy();};
  },[]);
  return <><div ref={host} style={{position:'fixed',inset:0}}/><aside style={{position:'fixed',top:16,left:16,right:16,font:'22px sans-serif',background:'#fcfaffee',borderRadius:16,padding:16,color:'#2b2246'}}>
    <strong>QA · ฉากจริง · ไม่เปิดกล้อง</strong><p style={{margin:'10px 0'}}>อาหารระยะ 15 · ออกกำลังกายระยะ 26</p>
    {(['camera','manual'] as const).map(value=><button key={value} aria-pressed={mode===value} onClick={()=>{frame.current=snapshot(value);setMode(value);}} style={{font:'bold 22px sans-serif',padding:'12px 20px',marginRight:10,borderRadius:12,border:0,background:mode===value?'#6c4ee8':'#e9e2f6',color:mode===value?'white':'#2b2246'}}>{value==='camera'?'กล้อง · ขยายไอเทม':'ปุ่ม · ขนาดเดิม'}</button>)}
  </aside></>;
}
const root=createRoot(document.getElementById('root')!);root.render(<Preview/>);import.meta.hot?.dispose(()=>root.unmount());
