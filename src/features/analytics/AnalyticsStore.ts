import type { RunRecord } from '../../game/learning/types';
import { cloudRun, type AnalyticsIdentity, type OutboxEntry, type SurveyCounter, type SurveyState } from './cloudContract';

export const ANALYTICS_STORES = ['analyticsIdentities', 'surveys', 'outbox'] as const;
export const RUN_SURVEY_STORE = 'runSurveys';
export function upgradeAnalytics(db: IDBDatabase, oldVersion: number, tx: IDBTransaction) {
  for (const name of ANALYTICS_STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: name === 'outbox' ? 'id' : 'playerId' });
  if (!db.objectStoreNames.contains(RUN_SURVEY_STORE)) {
    const decisions = db.createObjectStore(RUN_SURVEY_STORE, { keyPath: 'runId' });
    decisions.createIndex('playerId', 'playerId');
    if (oldVersion > 0) {
      // Existing terminal results predate per-run prompting. Do not reopen them after upgrade.
      const cursor = tx.objectStore('runs').openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result; if (!row) return;
        const run = row.value as RunRecord;
        if (['completed', 'game_over'].includes(run.outcome)) {
          const state: SurveyState = { runId: run.runId, playerId: run.playerId, status: 'historical' };
          decisions.put(state);
        }
        row.continue();
      };
    }
  }
}
export function entry(id: string, playerId: string, payload: OutboxEntry['payload']): OutboxEntry {
  return { id, playerId, payload, createdAt: Date.now(), attempts: 0, nextAttemptAt: 0, state: 'pending' };
}
export function newSurvey(playerId: string): SurveyCounter {
  return { playerId, eligibleCount: 0 };
}
export function identity(tx: IDBTransaction, playerId: string, callback: (value: AnalyticsIdentity) => void) {
  const store = tx.objectStore('analyticsIdentities'), req = store.get(playerId);
  req.onsuccess = () => {
    const value: AnalyticsIdentity = req.result ?? { playerId, analyticsPlayerId: crypto.randomUUID(),
      token: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('') };
    if (!req.result) store.put(value);
    callback(value);
  };
}
// Called inside the same transaction as the terminal run write. Old terminal records are not imported.
export function queueTerminal(tx: IDBTransaction, record: RunRecord, prior?: RunRecord) {
  if (record.outcome === 'in_progress' || (prior && prior.outcome !== 'in_progress')) return;
  identity(tx, record.playerId, () => {
    tx.objectStore('outbox').put(entry(`run:${record.runId}`, record.playerId, { kind: 'run', run: cloudRun(record) }));
    if (!['completed', 'game_over'].includes(record.outcome)) return;
    const store = tx.objectStore('surveys'), req = store.get(record.playerId);
    req.onsuccess = () => { const state: SurveyCounter = req.result ?? newSurvey(record.playerId); state.eligibleCount++; store.put(state); };
  });
}
