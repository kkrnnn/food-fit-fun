import React, { useState } from 'react';
import type { Profile } from '../../game/learning/types';
import { validateProfile } from '../health/assessment';

export const newProfile = (): Profile => ({ playerId: crypto.randomUUID(), nickname: '', version: 1, sex: 'male', ageMonths: 120, agePrecision: 'years', heightCm: 140, weightKg: 35, activity: '', avatar: 'mint' });
export const demoProfile = (): Profile => ({ ...newProfile(), playerId: 'demo-player', nickname: 'ผู้เล่นทดลอง' });

export function ProfileForm({ initial, onSave, onCancel }: { initial: Profile; onSave: (p: Profile) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState({ ...initial, ageMonths: Math.floor(initial.ageMonths / 12) * 12, agePrecision: 'years' as const });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft(p => ({ ...p, [key]: value }));
  const years = draft.ageMonths / 12;
  return <form onSubmit={async event => {
    event.preventDefault(); const errors = validateProfile(draft); if (errors.length) { setError(errors.join(' · ')); return; }
    setBusy(true); setError('');
    try { await onSave({ ...draft, ageMonths: years * 12, agePrecision: 'years', activity: '', nickname: draft.nickname.trim(), version: initial.version + 1 }); }
    catch (e) { setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); }
    finally { setBusy(false); }
  }}>
    <p className="lr-kicker">LET’S PLAY / ผู้เล่น</p><h1>พร้อมออกวิ่งหรือยัง?</h1><p>ใส่ชื่อและอายุ แล้วไปผจญภัยกัน!</p>
    <div className="lr-form-grid">
      <label className="lr-wide">ชื่อเล่น<input required maxLength={40} value={draft.nickname} onChange={e => change('nickname', e.target.value)} autoComplete="off" /></label>
      <label>เพศ<select value={draft.sex} onChange={e => change('sex', e.target.value as Profile['sex'])}><option value="male">ชาย</option><option value="female">หญิง</option></select></label>
      <label>อายุ (ปี)<input type="number" required step={1} value={Number.isFinite(years) ? years : ''} onChange={e => change('ageMonths', e.target.valueAsNumber * 12)} /></label>
      <label>ส่วนสูง (cm)<input type="number" required min={80} max={220} step="0.1" value={Number.isFinite(draft.heightCm) ? draft.heightCm : ''} onChange={e => change('heightCm', e.target.valueAsNumber)} /></label>
      <label>น้ำหนัก (kg)<input type="number" required min={10} max={200} step="0.1" value={Number.isFinite(draft.weightKg) ? draft.weightKg : ''} onChange={e => change('weightKg', e.target.valueAsNumber)} /></label>
    </div>
    <fieldset><legend>สีตัวละคร</legend><div className="lr-actions">{(['mint','rose','amber'] as const).map((color, i) => <button type="button" className={`lr-avatar ${color} ${draft.avatar === color ? 'selected' : ''}`} aria-pressed={draft.avatar === color} key={color} onClick={() => change('avatar', color)}>{['มิ้นต์','ชมพู','เหลือง'][i]}</button>)}</div></fieldset>
    {error && <p role="alert" className="lr-error">{error}</p>}
    <p className="lr-muted">ข้อมูลบันทึกบนอุปกรณ์นี้ ไม่ต้องใช้ชื่อจริง</p>
    <div className="lr-actions"><button type="submit" disabled={busy}>{busy ? 'กำลังเตรียม…' : 'เริ่มเกม →'}</button><button className="secondary" type="button" onClick={onCancel} disabled={busy}>กลับ</button></div>
  </form>;
}
