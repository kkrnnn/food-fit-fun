import type { DeckState, Profile, QuestionBank, RunRecord } from '../../game/learning/types';
import { parseBank } from '../../game/learning/QuestionDeck';
import { validateProfile } from '../health/assessment';

export interface StoredData { profiles: Profile[]; runs: RunRecord[]; bank: QuestionBank | null; }
const DATABASE = 'body-rush-learning-v1';
function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('บันทึกไม่สำเร็จ')); });
}

/** All persistent writes resolve on transaction completion, never just request success. */
export class RunRepository {
  private database: Promise<IDBDatabase> | null = null;
  private open(): Promise<IDBDatabase> {
    if (!this.database) this.database = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) { reject(new Error('อุปกรณ์นี้ไม่รองรับการบันทึก IndexedDB')); return; }
      const req = indexedDB.open(DATABASE, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('profiles', { keyPath: 'playerId' });
        db.createObjectStore('runs', { keyPath: 'runId' });
        db.createObjectStore('decks', { keyPath: 'id' });
        db.createObjectStore('settings');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { this.database = null; reject(req.error); };
      req.onblocked = () => { this.database = null; reject(new Error('ปิดแท็บเกมเก่าแล้วลองบันทึกใหม่')); };
    });
    return this.database;
  }
  async load(): Promise<StoredData> {
    const db = await this.open();
    const tx = db.transaction(['profiles', 'runs', 'settings'], 'readonly');
    const done = complete(tx);
    const [profiles, runs, bank] = await Promise.all([
      request<Profile[]>(tx.objectStore('profiles').getAll()), request<RunRecord[]>(tx.objectStore('runs').getAll()),
      request<QuestionBank | undefined>(tx.objectStore('settings').get('bank')),
    ]);
    await done;
    const validProfiles = profiles.filter(p => validateProfile(p).length === 0);
    const validRuns = runs.filter(r => r.schemaVersion === 1 && typeof r.runId === 'string' && Array.isArray(r.answers));
    return { profiles: validProfiles, runs: validRuns, bank: bank ? parseBank(bank) : null };
  }
  async saveProfile(profile: Profile): Promise<void> {
    const errors = validateProfile(profile); if (errors.length) throw new Error(errors.join(' · '));
    const db = await this.open(); const tx = db.transaction('profiles', 'readwrite'); const done = complete(tx);
    tx.objectStore('profiles').put(structuredClone(profile)); await done;
  }
  async deck(playerId: string, contentVersion: string): Promise<DeckState> {
    const db = await this.open(); const tx = db.transaction('decks', 'readonly'); const done = complete(tx);
    const found = await request<{ state: DeckState } | undefined>(tx.objectStore('decks').get(`${playerId}:${contentVersion}`));
    await done;
    return found?.state ?? { contentVersion, counts: {} };
  }
  async saveRun(record: RunRecord, displayedCount: number): Promise<void> {
    const snapshot = structuredClone(record);
    const db = await this.open(); const tx = db.transaction(['runs', 'decks'], 'readwrite'); const done = complete(tx);
    const store = tx.objectStore('runs');
    const priorReq = store.get(snapshot.runId);
    priorReq.onsuccess = () => {
      const prior = priorReq.result as RunRecord | undefined;
      // Late progress writes cannot undo a terminal record or remove already persisted answers.
      if (prior && ((prior.outcome !== 'in_progress' && snapshot.outcome === 'in_progress') || prior.answers.length > snapshot.answers.length)) return;
      store.put(snapshot);
      const id = `${snapshot.playerId}:${snapshot.contentVersion}`;
      const req = tx.objectStore('decks').get(id);
      req.onsuccess = () => {
        const state: DeckState = req.result?.state ?? { contentVersion: snapshot.contentVersion, counts: {} };
        for (const planned of snapshot.plannedQuestions.slice(0, displayedCount)) {
          const key = `${planned.question.questionId}@${planned.question.revision}`;
          state.counts[key] = Math.max(state.counts[key] ?? 0, planned.exposureCount);
        }
        tx.objectStore('decks').put({ id, playerId: snapshot.playerId, state });
      };
    };
    await done;
  }
  async recoverInterrupted(runId?: string): Promise<void> {
    const data = await this.load();
    for (const r of data.runs.filter(r => r.outcome === 'in_progress' && (!runId || r.runId === runId))) {
      r.outcome = 'abandoned'; r.endReason = 'interrupted'; r.endedAt = new Date().toISOString();
      await this.saveRun(r, r.answers.length); // exposure already persisted when each question appeared
    }
  }
  async importBank(input: unknown): Promise<QuestionBank> {
    const bank = parseBank(input);
    const existing = (await this.load()).bank;
    if (existing?.contentVersion === bank.contentVersion && JSON.stringify(existing) !== JSON.stringify(bank)) throw new Error('เนื้อหาเปลี่ยน: กรุณาใช้ contentVersion ใหม่');
    const db = await this.open(); const tx = db.transaction('settings', 'readwrite'); const done = complete(tx);
    tx.objectStore('settings').put(bank, 'bank'); await done; return bank;
  }
  async clear(playerId?: string): Promise<void> {
    const db = await this.open(); const tx = db.transaction(['profiles', 'runs', 'decks', 'settings'], 'readwrite'); const done = complete(tx);
    if (!playerId) ['profiles', 'runs', 'decks', 'settings'].forEach(name => tx.objectStore(name).clear());
    else {
      tx.objectStore('profiles').delete(playerId);
      for (const name of ['runs', 'decks']) {
        const cursor = tx.objectStore(name).openCursor();
        cursor.onsuccess = () => { const c = cursor.result; if (!c) return; if (c.value.playerId === playerId) c.delete(); c.continue(); };
      }
    }
    await done;
  }
}

export function highScore(records: RunRecord[], current: RunRecord): number {
  return Math.max(0, ...records.filter(r => r.playerId === current.playerId && r.demo === current.demo
    && ['completed', 'game_over'].includes(r.outcome) && r.levelVersion === current.levelVersion
    && r.scoringVersion === current.scoringVersion && r.contentVersion === current.contentVersion
    && r.blueprintVersion === current.blueprintVersion && r.inputModeGroup === current.inputModeGroup)
    .map(r => r.score));
}

export function summarize(records: RunRecord[], firstOnly: boolean) {
  const groups = new Map<string, { age: number; players: Set<string>; runs: number; completed: number; failed: number; answered: number; correct: number; perPlayer: Map<string, { correct: number; count: number }> }>();
  const topics = new Map<string, { topic: string; count: number; correct: number; players: Set<string> }>();
  const items = new Map<string, { id: string; count: number; correct: number; players: Set<string> }>();
  for (const r of records.filter(r => !r.demo && r.outcome !== 'in_progress')) {
    const age = Math.floor(r.ageMonthsAtStart / 12);
    const g = groups.get(String(age)) ?? { age, players: new Set(), runs: 0, completed: 0, failed: 0, answered: 0, correct: 0, perPlayer: new Map() };
    g.players.add(r.playerId); g.runs++; if (r.outcome === 'completed') g.completed++; if (r.outcome === 'game_over') g.failed++;
    for (const a of r.answers.filter(a => !firstOnly || a.isFirstExposure)) {
      g.answered++; if (a.isCorrect) g.correct++;
      const p = g.perPlayer.get(r.playerId) ?? { correct: 0, count: 0 }; p.count++; if (a.isCorrect) p.correct++; g.perPlayer.set(r.playerId, p);
      const t = topics.get(a.topic) ?? { topic: a.topic, count: 0, correct: 0, players: new Set() };
      t.count++; t.players.add(r.playerId); if (a.isCorrect) t.correct++; topics.set(a.topic, t);
      const key = `${r.contentVersion}/${a.questionId}@${a.revision}`;
      const q = items.get(key) ?? { id: key, count: 0, correct: 0, players: new Set() };
      q.count++; q.players.add(r.playerId); if (a.isCorrect) q.correct++; items.set(key, q);
    }
    groups.set(String(age), g);
  }
  return { ages: [...groups.values()].sort((a, b) => a.age - b.age).map(g => ({ age: g.age, players: g.players.size, runs: g.runs,
    completed: g.completed, failed: g.failed, answered: g.answered, correct: g.correct,
    playerAccuracy: g.perPlayer.size ? [...g.perPlayer.values()].reduce((n, p) => n + p.correct / p.count, 0) / g.perPlayer.size : null,
  })), topics: [...topics.values()].map(t => ({ ...t, players: t.players.size })), items: [...items.values()].map(q => ({ ...q, players: q.players.size })) };
}

const csvCell = (v: unknown) => {
  let text = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`; // spreadsheet formula injection
  return `"${text.replace(/"/g, '""')}"`;
};
export function exportData(runs: RunRecord[]) {
  const safe = runs.map(r => { const { plannedQuestions, initialBmi: _initialBmi, simulatedBmi: _simulatedBmi, ...rest } = r; return { ...rest, plannedQuestionIds: plannedQuestions.map(q => `${q.question.questionId}@${q.question.revision}`) }; });
  const rows = (headers: string[], values: unknown[][]) => '\ufeff' + [headers, ...values].map(row => row.map(csvCell).join(',')).join('\r\n');
  return {
    json: JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), runs: safe }, null, 2),
    runsCsv: rows(['runId','playerId','ageYearsAtStart','agePrecision','ageMonthsAtStart','contentVersion','blueprintVersion','inputMode','outcome','reason','demo','score','answered','correct','incorrect','unreached','distance','trackingPauseCount','trackingPauseMs','startedAt'],
      runs.map(r => [r.runId,r.playerId,Math.floor(r.ageMonthsAtStart / 12),r.agePrecision ?? 'months',r.ageMonthsAtStart,r.contentVersion,r.blueprintVersion,r.inputModeGroup,r.outcome,r.endReason,r.demo,r.score,r.answers.length,r.correctCount,r.incorrectCount,r.unreachedCount,r.distance,r.trackingPauseCount,r.trackingPauseMs,r.startedAt])),
    answersCsv: rows(['runId','playerId','ageYearsAtStart','agePrecision','ageMonthsAtStart','contentVersion','questionId','revision','topic','difficulty','optionMapping','selectedOptionId','correctOptionId','isCorrect','isFirstExposure','exposureCount','readMs','selectionMs','wrongStreakAfter'],
      runs.flatMap(r => r.answers.map(a => [r.runId,r.playerId,Math.floor(r.ageMonthsAtStart / 12),r.agePrecision ?? 'months',r.ageMonthsAtStart,r.contentVersion,a.questionId,a.revision,a.topic,a.difficulty,JSON.stringify(a.options),a.selectedOptionId,a.correctOptionId,a.isCorrect,a.isFirstExposure,a.exposureCount,a.readMs,a.selectionMs,a.wrongStreakAfter]))),
  };
}
