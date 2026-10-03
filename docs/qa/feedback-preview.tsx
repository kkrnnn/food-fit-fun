// Dev-only component QA. Isolated storage; no network transmission and no production entry point.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FeedbackPanel } from '../../src/features/analytics/FeedbackPanel';
import { RunRepository } from '../../src/features/analytics/RunRepository';
import { RunSession } from '../../src/game/learning/RunSession';
import { DEMO_BANK, createQuestionSet } from '../../src/game/learning/QuestionDeck';
import type { RunRecord, Profile } from '../../src/game/learning/types';
import '../../src/features/learning/LearningGame.css';

const qaCase = (new URLSearchParams(location.search).get('case') ?? 'default').replace(/[^a-z0-9-]/gi, '').slice(0,40);
const repository = new RunRepository(`food-fit-fun-feedback-qa-${qaCase}`);
const profile: Profile = { playerId:'qa-player',nickname:'QA',version:1,sex:'male',ageMonths:120,heightCm:140,weightKg:35,activity:'active',avatar:'mint' };
async function addRun() {
  const session=new RunSession(profile,createQuestionSet(DEMO_BANK,120,{contentVersion:DEMO_BANK.contentVersion,counts:{}},42,true),{
    runId:crypto.randomUUID(),startedAt:new Date().toISOString(),seed:42,demo:true,contentVersion:DEMO_BANK.contentVersion,blueprintVersion:DEMO_BANK.blueprintVersion,mode:'manual'});
  session.advance(1000);session.advance(6);session.endRun('game_over','qa');const record=session.snapshot().record;await repository.saveRun(record,1);return record;
}
function Preview() {
  const [run,setRun]=useState<RunRecord|null>(null),[count,setCount]=useState(0);
  const refresh=async()=>{const data=await repository.load();setCount(data.runs.length);return data;};
  useEffect(()=>{void(async()=>{let data=await refresh();while(data.runs.length<3){await addRun();data=await refresh();}setRun(data.runs.sort((a,b)=>a.startedAt.localeCompare(b.startedAt)).at(-1)!);})();},[]);
  return <main className="lr-game" style={{minHeight:'100vh',height:'auto',background:'#eee8fa',padding:'16px',boxSizing:'border-box'}}><div className="lr-sheet" style={{margin:'0 auto',maxWidth:780}}>
    <p className="lr-kicker">COMPONENT QA · ข้อมูลทดลอง · {count} รอบ</p><h1>มาลองทบทวนกัน</h1><p>Game Over · ตัวอย่างหน้าผล</p><div className="lr-result-score"><strong>{run?.score??0}</strong><span>คะแนนรอบนี้</span></div>
    <p className="lr-cloud-status">บันทึกในเครื่องแล้ว · ยังไม่ได้ตั้งค่า Supabase</p>
    {run&&<FeedbackPanel key={run.runId} runId={run.runId} repository={repository} waitForSave={()=>Promise.resolve()} onChange={()=>{void refresh();}}/>}
    <div className="lr-actions"><button onClick={async()=>{setRun(await addRun());await refresh();}}>จบรอบเพิ่ม (QA)</button></div><p className="lr-muted">ใช้ฐานข้อมูล QA แยกจากเกมจริง · Reload เพื่อตรวจว่ายังจำดาวที่ส่งแล้ว</p>
  </div></main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
