import React, { useEffect, useState } from 'react';
import type { RunRepository } from './RunRepository';
import { FEEDBACK_COMMENT_LIMIT, type SurveyState } from './cloudContract';

const labels = ['ไม่สนุกเลย', 'สนุกน้อย', 'พอใช้', 'สนุก', 'สนุกมาก'];
export function FeedbackPanel({ runId, repository, waitForSave, onChange }: {
  runId: string; repository: RunRepository; waitForSave: () => Promise<void>; onChange: () => void;
}) {
  const [survey, setSurvey] = useState<{ visible: boolean; state: SurveyState } | null>(null);
  const [rating, setRating] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [comment, setComment] = useState('');
  useEffect(() => {
    let active = true;
    void waitForSave().then(() => repository.prepareSurvey(runId)).then(value => {
      if (active) { setSurvey(value); onChange(); }
    }).catch(() => { if (active) setError('บันทึกผลรอบนี้ก่อน จึงจะเก็บความคิดเห็นได้'); });
    return () => { active = false; };
  }, [runId, repository]);
  const answer = async (value: number | null) => {
    setBusy(true); setError('');
    try { await repository.answerSurvey(runId, value, value === null ? undefined : comment); setSurvey(await repository.prepareSurvey(runId)); onChange(); }
    catch { setError('บันทึกความคิดเห็นไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  };
  if (error && !survey) return <p className="lr-error" role="alert">{error}</p>;
  if (!survey?.visible) return survey?.state.status === 'submitted' ? <p className="lr-feedback-thanks" role="status">ขอบคุณสำหรับ {survey.state.rating} ดาว! เก็บความคิดเห็นรอบนี้ไว้แล้ว</p> : null;
  return <section className="lr-enjoyment" aria-labelledby="enjoyment-title">
    <p className="lr-kicker">ความรู้สึกหลังเล่น</p><h2 id="enjoyment-title">รอบนี้เล่นสนุกไหม?</h2>
    <fieldset disabled={busy}><legend>เลือก 1–5 ดาว</legend><div className="lr-rating">
      {labels.map((label, i) => <label key={label}><input type="radio" name={`enjoyment-${runId}`} value={i + 1} checked={rating === i + 1} onChange={() => setRating(i + 1)} aria-label={`${i + 1} ดาว · ${label}`} />
        <span className={rating >= i + 1 ? 'filled' : ''} aria-hidden="true">★</span></label>)}
    </div></fieldset>
    <p className="lr-rating-label" aria-live="polite">{rating ? `${rating} ดาว · ${labels[rating - 1]}` : '1 = ไม่สนุกเลย · 5 = สนุกมาก'}</p>
    <label className="lr-feedback-comment" htmlFor={`feedback-comment-${runId}`}>อยากให้ปรับอะไร? (ไม่บังคับ)
      <textarea id={`feedback-comment-${runId}`} rows={3} maxLength={FEEDBACK_COMMENT_LIMIT} value={comment} disabled={busy}
        placeholder="เล่าให้ฟังได้เลย เช่น อาหารที่อยากเพิ่ม หรือส่วนที่เล่นยาก" onChange={event => setComment(event.target.value)}
        aria-describedby={`feedback-comment-count-${runId}`} />
    </label>
    <small className="lr-comment-count" id={`feedback-comment-count-${runId}`}>{comment.length.toLocaleString('th-TH')} / 1,000 ตัวอักษร</small>
    <div className="lr-actions"><button disabled={!rating || busy} onClick={() => void answer(rating)}>{busy ? 'กำลังบันทึก…' : 'ส่งความคิดเห็น'}</button><button className="secondary" disabled={busy} onClick={() => void answer(null)}>ข้ามก่อน</button></div>
    <small>ส่งหรือข้ามได้หนึ่งครั้งต่อรอบ · รอบหน้าถามใหม่ · ดาวไม่เปลี่ยนคะแนนเกม</small>
    {error && <p className="lr-error" role="alert">{error}</p>}
  </section>;
}
