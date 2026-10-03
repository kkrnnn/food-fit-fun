import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { RunRepository, exportData, highScore, summarize } from './RunRepository';
import { RunSession } from '../../game/learning/RunSession';
import { createQuestionSet, DEMO_BANK } from '../../game/learning/QuestionDeck';
import type { Profile, RunRecord } from '../../game/learning/types';
const p: Profile = { playerId: 'player', nickname: 'ทดสอบ', version: 1, sex: 'male', ageMonths: 120, heightCm: 140, weightKg: 35, activity: 'active', avatar: 'mint' };
const newRun = (runId = 'test-run', playerId = 'player') => new RunSession({ ...p, playerId }, createQuestionSet(DEMO_BANK,120,{contentVersion:DEMO_BANK.contentVersion,counts:{}},42,true), {
  runId, seed:42, startedAt:'2026-10-02T00:00:00Z', demo:false, contentVersion:DEMO_BANK.contentVersion, blueprintVersion:DEMO_BANK.blueprintVersion, mode:'manual',
});
const getAnswer = (run: RunSession) => { run.advance(1000); run.advance(6); };
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));

describe('persistent public repository', () => {
  it('saves/reloads/edits a profile and atomically persists answers and displayed exposures', async () => {
    const repo = new RunRepository(); await repo.saveProfile(p);
    expect((await new RunRepository().load()).profiles).toEqual([p]);
    await repo.saveProfile({ ...p, ageMonths:132, version:2 });
    const run = newRun(); run.advance(1000); const reading = run.snapshot();
    await repo.saveRun(reading.record,1); await repo.saveRun(reading.record,1);
    const deck = await repo.deck(p.playerId,DEMO_BANK.contentVersion);
    expect(Object.values(deck.counts)).toEqual([1]);
    expect((await repo.load()).runs).toHaveLength(1);
    run.advance(6); run.endRun('abandoned','player_exit');
    await repo.saveRun(run.snapshot().record,1);
    // A stale write may not resurrect a terminated run or drop an answer.
    await repo.saveRun(reading.record,1);
    const data = await repo.load(); expect(data.runs[0].outcome).toBe('abandoned'); expect(data.runs[0].answers).toHaveLength(1);
    expect(data.runs[0].ageMonthsAtStart).toBe(120); expect(data.profiles[0].ageMonths).toBe(132);
  });
  it('recovers interrupted runs without classifying unseen questions as incorrect', async () => {
    const repo = new RunRepository(); const run = newRun(); getAnswer(run);
    await repo.saveRun(run.snapshot().record,1); await repo.recoverInterrupted();
    const r = (await repo.load()).runs[0];
    expect(r.outcome).toBe('abandoned'); expect(r.endReason).toBe('interrupted'); expect(r.answers).toHaveLength(1); expect(r.unreachedCount).toBe(9);
  });
  it('recovers only the interrupted tab run, preserving another active run', async () => {
    const repo = new RunRepository(); const own = newRun('own'); const other = newRun('other');
    await repo.saveRun(own.snapshot().record,0); await repo.saveRun(other.snapshot().record,0);
    await repo.recoverInterrupted('own');
    const data = await repo.load();
    expect(data.runs.find(r => r.runId === 'own')?.outcome).toBe('abandoned');
    expect(data.runs.find(r => r.runId === 'other')?.outcome).toBe('in_progress');
  });
  it('clears one player with history/deck, preserving the other, then clears all', async () => {
    const repo = new RunRepository(); await repo.saveProfile(p); await repo.saveProfile({ ...p, playerId:'other' });
    const a = newRun(); a.advance(1000); const b = newRun('other-run','other'); b.advance(1000);
    await repo.saveRun(a.snapshot().record,1); await repo.saveRun(b.snapshot().record,1); await repo.clear('player');
    const data = await repo.load(); expect(data.profiles.map(p => p.playerId)).toEqual(['other']); expect(data.runs.map(r => r.playerId)).toEqual(['other']);
    expect((await repo.deck('player',DEMO_BANK.contentVersion)).counts).toEqual({});
    await repo.clear(); expect(await repo.load()).toEqual({ profiles:[],runs:[],bank:null });
  });
  it('rejects mutable same-version bank imports and exposes unavailable storage as failure', async () => {
    const repo = new RunRepository(); await repo.importBank(DEMO_BANK);
    const changed = structuredClone(DEMO_BANK); changed.questions[0].prompt = 'เปลี่ยนข้อความ';
    await expect(repo.importBank(changed)).rejects.toThrow('contentVersion ใหม่');
    vi.stubGlobal('indexedDB',undefined); await expect(new RunRepository().load()).rejects.toThrow('ไม่รองรับ');
  });
});

describe('scores, age analytics and exports', () => {
  const sample = (): RunRecord => { const run = newRun(); getAnswer(run); run.endRun('game_over','fixture'); return run.snapshot().record; };
  it('isolates best scores by player/content/input/scoring versions and excludes abandoned attempts', () => {
    const r = sample();
    const candidates = [r, { ...r, score:9999, demo:true }, { ...r, score:9999, scoringVersion:'different' }, { ...r,score:9999,playerId:'other' }, { ...r,score:9999,outcome:'abandoned' as const }];
    expect(highScore(candidates,r)).toBe(r.score);
  });
  it('counts unique players, age snapshots, real answers and first exposures rather than all ten planned', () => {
    const r = sample(); const repeated = { ...r,runId:'repeat',answers:r.answers.map(a => ({ ...a,isFirstExposure:false,exposureCount:2 })) };
    const demo = { ...r,playerId:'demo',demo:true };
    const s = summarize([r,repeated,demo],true);
    expect(s.ages[0].players).toBe(1); expect(s.ages[0].runs).toBe(2); expect(s.ages[0].answered).toBe(1);
    expect(s.ages[0].age).toBe(10); expect(s.items[0].count).toBe(1);
    expect(summarize([r,repeated],false).ages[0].answered).toBe(2);
  });
  it('exports linked run/answer rows without profile health data or unasked answer keys; escapes formulas', () => {
    const r = sample(); r.playerId = '=HYPERLINK("bad")';
    const e = exportData([r]); const json = JSON.parse(e.json);
    expect(json.runs[0].plannedQuestionIds).toHaveLength(10); expect(json.runs[0]).not.toHaveProperty('plannedQuestions');
    expect(e.answersCsv.split('\r\n')).toHaveLength(2);
    expect(e.runsCsv).toContain("'=HYPERLINK"); expect(e.json).not.toContain('weightKg'); expect(e.json).not.toContain('initialBmi'); expect(e.json).not.toContain('simulatedBmi');
  });
});
