import React, { useEffect, useState } from 'react';
import { RESEARCH_BANK } from '../../game/learning/ResearchBank';
import type { InputMode, Lane } from '../../game/learning/types';

export function Practice({ mode, cameraReady, detectedLane }: { mode: InputMode; cameraReady: boolean; detectedLane: Lane }) {
  const [lane, setLane] = useState<Lane>(1);
  const [step, setStep] = useState<'item' | 'quiz'>('item');
  const [message, setMessage] = useState('');
  useEffect(() => { if (mode === 'camera' && cameraReady) setLane(detectedLane); }, [mode, cameraReady, detectedLane]);
  const question = RESEARCH_BANK.questions[0];
  const labels = step === 'item' ? ['🍎 อาหารหลากหลาย', '🍔 เลือกแต่พอดี', '💧 น้ำเปล่า'] : question.options.map(option => option.text);
  return <section className="lr-practice"><p className="lr-kicker">ลองก่อนเล่น · ไม่บันทึกคะแนน</p>
    <h2>{step === 'item' ? 'ลองเลือกเลนเก็บของ' : `ทดลองประตู: ${question.prompt}`}</h2>
    <div className="lr-answers">{labels.map((label, i) => <button key={label} className={lane === i ? 'selected' : ''} disabled={mode === 'camera'} onClick={() => { setLane(i as Lane); setMessage(''); }}><span>{['ซ้าย','กลาง','ขวา'][i]}</span><strong>{label}</strong></button>)}</div>
    <p className="lr-muted">{mode === 'camera' ? 'ขยับไหล่แล้วดูเลนที่ไฮไลต์' : 'กดเลือกเลนด้านบน'} แล้วกดทดลอง</p>
    <div className="lr-actions"><button disabled={mode === 'camera' && !cameraReady} onClick={() => setMessage(step === 'item' ? ['แอปเปิล 1 ผลใหญ่ (242 g) · +130 kcal','แฮมเบอร์เกอร์ 1 ชิ้น (McDonald’s US) · +250 kcal','น้ำเปล่า 500 ml · 0 kcal'][lane] : question.options[lane].optionId === question.correctOptionId ? '✓ ตรงกับเฉลยที่เสนอ' : question.explanation)}>{step === 'item' ? 'ทดลองเก็บของ' : 'ทดลองตอบ'}</button><button className="secondary" onClick={() => { setStep(step === 'item' ? 'quiz' : 'item'); setMessage(''); }}>{step === 'item' ? 'ลองประตูคำตอบ' : 'ลองเก็บของอีกครั้ง'}</button></div>
    {message && <p role="status">{message}</p>}
  </section>;
}
