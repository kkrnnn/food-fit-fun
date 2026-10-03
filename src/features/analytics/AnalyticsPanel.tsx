import React, { useMemo, useState } from 'react';
import type { RunRecord } from '../../game/learning/types';
import { exportData, summarize } from './RunRepository';
import { DEMO_BANK } from '../../game/learning/QuestionDeck';

export function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const percent = (n: number, d: number) => d ? `${Math.round(n / d * 100)}%` : '—';

export function AnalyticsPanel({ runs, contentVersion, onImport, onClear, onBack }: {
  runs: RunRecord[]; contentVersion?: string; onImport: (value: unknown) => Promise<void>; onClear: () => Promise<void>; onBack: () => void;
}) {
  const [firstOnly, setFirstOnly] = useState(true);
  const [version, setVersion] = useState('');
  const [mode, setMode] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const real = runs.filter(r => !r.demo);
  const data = useMemo(() => summarize(real.filter(r => (!version || `${r.contentVersion}|${r.blueprintVersion}` === version) && (!mode || r.inputModeGroup === mode)), firstOnly), [runs, version, mode, firstOnly]);
  const files = exportData(runs);
  const scopeCount = data.ages.reduce((sum, g) => sum + g.runs, 0);
  return <>
    <p className="lr-kicker">สำหรับผู้ดูแล / ข้อมูลในอุปกรณ์นี้</p><h1>คำตอบบอกอะไรบ้าง</h1>
    <p>คลังจริง: {contentVersion ?? 'ยังไม่มี — ตอนนี้เล่นได้ด้วยชุดทดลอง'} · รอบจริง {real.length} · รอบทดลอง {runs.length - real.length}</p>
    <div className="lr-actions"><button className="secondary" onClick={() => download('food-fit-fun-runs.json', files.json)}>Export JSON</button>
      <button className="secondary" onClick={() => download('food-fit-fun-runs.csv', files.runsCsv, 'text/csv;charset=utf-8')}>Runs CSV</button>
      <button className="secondary" onClick={() => download('food-fit-fun-answers.csv', files.answersCsv, 'text/csv;charset=utf-8')}>Answers CSV</button></div>
    <div className="lr-filter"><label>คลัง / ชุดความยาก<select value={version} onChange={e => setVersion(e.target.value)}><option value="">ทุกคลัง (ดูภาพรวมเท่านั้น)</option>{[...new Set(real.map(r => `${r.contentVersion}|${r.blueprintVersion}`))].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>วิธีควบคุม<select value={mode} onChange={e => setMode(e.target.value)}><option value="">ทุกวิธี</option><option value="camera">กล้อง</option><option value="manual">คีย์บอร์ด / สัมผัส</option><option value="mixed">เปลี่ยนระหว่างรอบ</option></select></label>
      <label className="lr-checkbox"><input type="checkbox" checked={firstOnly} onChange={e => setFirstOnly(e.target.checked)} />เฉพาะคำตอบครั้งแรกที่เห็นข้อ</label></div>
    <p className="lr-muted">ผิด 3 ข้อติดทำให้บางคนไม่เห็นข้อท้าย ข้อที่ยังไม่ถึงไม่ถูกนับว่าผิด · ผลนี้แสดงความถูกต้องในรอบ ไม่พิสูจน์ว่าความรู้เพิ่มหรืออายุเป็นสาเหตุ · การจับท่าหลุดอาจส่งผลต่อการเล่น</p>
    {!scopeCount ? <div className="lr-empty">ยังไม่มีรอบจริงในช่วงที่เลือก<br /><small>ผลชุดทดลองแยกไว้และ export ได้ นำเข้าคลังที่ผ่านตรวจเพื่อเริ่มเก็บข้อมูลจริง</small></div> : <div className="lr-table-wrap"><table><caption>ผลตามอายุ — จำนวนเด็กนับจาก playerId ในเครื่อง</caption><thead><tr><th>อายุ</th><th>ผู้เล่น</th><th>รอบ</th><th>จบ / แพ้</th><th>ถูก / ตอบ</th><th>ถูกแบบรวม</th><th>เฉลี่ยต่อผู้เล่น</th></tr></thead><tbody>{data.ages.map(g => <tr key={g.age}><td>{g.age} ปี</td><td>{g.players}</td><td>{g.runs}</td><td>{g.completed} / {g.failed}</td><td>{g.correct} / {g.answered}</td><td>{percent(g.correct, g.answered)}</td><td>{g.playerAccuracy === null ? '—' : `${Math.round(g.playerAccuracy * 100)}%`}</td></tr>)}</tbody></table></div>}
    {!!data.topics.length && <div className="lr-table-wrap"><table><caption>หัวข้อที่ตอบ</caption><thead><tr><th>หัวข้อ</th><th>ผู้เล่น</th><th>ถูก / ตอบ</th><th>ถูก</th></tr></thead><tbody>{data.topics.map(t => <tr key={t.topic}><td>{t.topic}</td><td>{t.players}</td><td>{t.correct} / {t.count}</td><td>{percent(t.correct, t.count)}</td></tr>)}</tbody></table></div>}
    {!!data.items.length && <details><summary>ดูจำนวนครั้งที่เห็นและคำตอบรายข้อ</summary><div className="lr-table-wrap"><table><thead><tr><th>คำถาม / revision</th><th>ผู้เล่น</th><th>ถูก / คำตอบที่เลือกดู</th></tr></thead><tbody>{data.items.map(q => <tr key={q.id}><td>{q.id}</td><td>{q.players}</td><td>{q.correct} / {q.count}</td></tr>)}</tbody></table></div></details>}
    <hr /><h2>คลังคำถาม</h2><p>นำเข้า JSON ตาม schema ตัวอย่าง อย่างน้อย 10 ข้อที่ผ่านตรวจและตรงช่วงวัย เปลี่ยน contentVersion เมื่อแก้เนื้อหา</p>
    <div className="lr-actions"><button className="secondary" onClick={() => download('question-bank-template.json', DEMO_BANK ? JSON.stringify(DEMO_BANK, null, 2) : '')}>ดาวน์โหลดตัวอย่าง JSON</button>
      <label className="lr-upload">{busy ? 'กำลังนำเข้า…' : 'นำเข้าคลัง JSON'}<input type="file" accept=".json,application/json" disabled={busy} onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return; setError(''); setBusy(true);
        try { if (file.size > 2_000_000) throw new Error('ไฟล์ต้องไม่เกิน 2 MB'); await onImport(JSON.parse(await file.text())); }
        catch (err) { setError(err instanceof Error ? err.message : 'นำเข้าไม่สำเร็จ'); }
        finally { setBusy(false); e.target.value = ''; }
      }} /></label></div>
    <p className="lr-muted">ตัวอย่างมี reviewStatus: draft ต้องตรวจคำถามและเปลี่ยนเป็น reviewed ก่อนใช้กับข้อมูลจริง ผลในเครื่องไม่รวมกับอุปกรณ์อื่นเอง</p>
    {error && <p className="lr-error" role="alert">{error}</p>}
    <hr /><div className="lr-actions"><button onClick={onBack}>กลับเมนู</button><button className="secondary danger" onClick={() => setConfirm(true)}>ล้างข้อมูลทั้งหมด</button></div>
    {confirm && <div className="lr-confirm" role="alert"><p>ลบโปรไฟล์ ประวัติ คะแนน และคลังคำถามทั้งหมดบนเครื่องนี้? Export ก่อนล้างได้จากปุ่มด้านบน</p><div className="lr-actions"><button disabled={busy} onClick={async () => { setBusy(true); try { await onClear(); setConfirm(false); } catch { setError('ล้างข้อมูลไม่สำเร็จ'); } finally { setBusy(false); } }}>ยืนยันล้างข้อมูล</button><button className="secondary" onClick={() => setConfirm(false)}>ยกเลิก</button></div></div>}
  </>;
}
