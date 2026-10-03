// Dev-only rendering QA: no storage, camera, cloud requests or production entry point.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameEngine3D } from '../../src/game/three/GameEngine3D';
import { RunSession, COURSE_SPEED, GATE_SPACING, QUIZ_APPROACH_DISTANCE } from '../../src/game/learning/RunSession';
import { DEMO_BANK, createQuestionSet } from '../../src/game/learning/QuestionDeck';
import { bmiMeter } from '../../src/features/health/assessment';
import type { Profile, Snapshot, SceneItem, Lane } from '../../src/game/learning/types';
const profile: Profile = { playerId:'qa',nickname:'QA',sex:'male',ageMonths:360,agePrecision:'years',heightCm:175,weightKg:72,version:1,activity:'',avatar:'mint' };
const make = () => new RunSession(profile, createQuestionSet(DEMO_BANK,360,{contentVersion:DEMO_BANK.contentVersion,counts:{}},42,true), { runId:'qa',startedAt:'2026-10-03',seed:42,demo:true,contentVersion:DEMO_BANK.contentVersion,blueprintVersion:DEMO_BANK.blueprintVersion,mode:'manual' });
function frame(name: string): {snapshot:Snapshot;items:SceneItem[]} {
  const run = make();
  if(name === 'jump') {
    const item = run.visibleItems()[0]; run.setLane(item.lane); run.advance(item.distance/COURSE_SPEED-.45); run.jump(); run.advance(.425);
  } else {
    run.advance((GATE_SPACING-QUIZ_APPROACH_DISTANCE-1)/COURSE_SPEED);
    if(name !== 'before') run.advance(1/COURSE_SPEED);
    if(name === 'near' || name === 'after') run.advance(5);
    if(name === 'after') { const q=run.snapshot().question!; run.setLane(q.options.findIndex(o=>o.optionId===q.question.correctOptionId) as Lane); run.advance(1); }
  }
  return {snapshot:run.snapshot(),items:run.visibleItems()};
}
function Preview() {
  const root=useRef<HTMLDivElement>(null), engine=useRef<GameEngine3D|null>(null), current=useRef(frame('before'));
  const [name,setName]=useState('before');
  const [stats,setStats]=useState('');
  useEffect(()=> {engine.current=new GameEngine3D(root.current!); engine.current.setGraphicsQuality('medium'); let id=0, frames=0, last=performance.now();
    const draw=()=>{engine.current!.renderLearning(current.current.snapshot,current.current.items,.016,'mint'); frames++;const now=performance.now();if(now-last>=1000){setStats(`${Math.round(frames*1000/(now-last))} fps · ${engine.current!.renderer.info.render.calls} draw calls`);frames=0;last=now;} id=requestAnimationFrame(draw);}; draw();
    return()=>{cancelAnimationFrame(id);engine.current?.destroy();};},[]);
  const meter=bmiMeter(profile,current.current.snapshot.simulatedBmi);
  return <><div ref={root} style={{position:'fixed',inset:0}}/><aside style={{position:'fixed',top:10,left:10,right:10,padding:12,borderRadius:14,background:'#fffdf3ed',fontFamily:'sans-serif',color:'#33264f'}}>
    <strong>QA · ฉากเกมจริง · ไม่มีการส่งข้อมูล</strong><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>{[['before','ก่อน gate'],['near','ใกล้ gate'],['after','ผ่าน gate'],['jump','กระโดดสูง']].map(([value,label])=><button key={value} onClick={()=>{current.current=frame(value);setName(value);}} style={{padding:'8px 12px',background:name===value?'#684ddb':'#eee8fc',color:name===value?'white':'#33264f',border:0,borderRadius:8}}>{label}</button>)}</div>
    <p style={{marginBottom:0}}>{current.current.snapshot.phase} · อาหารที่รอหลัง gate {current.current.items.filter(i=>i.distance>GATE_SPACING).length} ชิ้น · ระยะ {current.current.snapshot.distance.toFixed(1)} · {stats}</p>
  </aside><aside style={{position:'fixed',bottom:15,left:15,padding:12,borderRadius:12,background:'#fffdf3ed',fontFamily:'sans-serif'}}><b>BMI ตัวละคร {current.current.snapshot.simulatedBmi.toFixed(1)} · จำลอง</b><div style={{width:240,height:12,background:meter.gradient,margin:'8px 0',position:'relative'}}><i style={{position:'absolute',left:`${meter.position}%`,height:20,width:3,background:meter.color,top:-4}}/></div>{meter.referenceLabel}<br/>{meter.label}</aside></>;
}
const qaRoot=createRoot(document.getElementById('root')!);
qaRoot.render(<Preview/>);
import.meta.hot?.dispose(()=>qaRoot.unmount());
