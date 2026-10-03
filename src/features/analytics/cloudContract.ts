import type { RunRecord, Profile } from '../../game/learning/types';

export const SURVEY_VERSION = 'enjoyment-v1';
export const SURVEY_INTERVAL = 3;
export const FEEDBACK_COMMENT_LIMIT = 1000;
export interface AnalyticsIdentity { playerId: string; analyticsPlayerId: string; token: string; }
export interface SurveyState {
  playerId: string; eligibleCount: number; nextAsk: number; submitted: boolean;
  shownRunId?: string; rating?: number; comment?: string;
}
export interface CloudRun {
  runId: string; startedAt: string; endedAt?: string; outcome: Exclude<RunRecord['outcome'], 'in_progress'>;
  playerName: string | null; sex: Profile['sex'] | null; ageYears: number;
  bmiStart: number | null; bmiEnd: number | null; testScore: number; gameScore: number;
  demo: boolean; contentVersion: string;
}
export type CloudPayload =
  | { kind: 'run'; run: CloudRun }
  | { kind: 'feedback'; contextRunId: string; surveyVersion: string; rating: number; comment?: string; eligibleRunCount: number; occurredAt: string }
  // Compatibility with already queued v1 events. New clients do not create or upload these.
  | { kind: 'event'; contextRunId: string; eventId: string; surveyVersion: string; event: 'shown' | 'skipped'; occurredAt: string };
export interface OutboxEntry {
  id: string; playerId: string; payload: CloudPayload; createdAt: number; attempts: number; nextAttemptAt: number;
  state: 'pending' | 'synced' | 'blocked'; error?: string;
}

/** Start-of-run profile snapshots; BMI end is the simulated character value, not a new measurement. */
export function cloudRun(r: RunRecord): CloudRun {
  if (r.outcome === 'in_progress') throw new InvalidPayload('รอบยังไม่จบ');
  return { runId: r.runId, startedAt: r.startedAt, endedAt: r.endedAt, outcome: r.outcome,
    playerName: r.playerNameAtStart ?? null, sex: r.sexAtStart ?? null, ageYears: Math.floor(r.ageMonthsAtStart / 12),
    bmiStart: r.initialBmi ?? null, bmiEnd: r.simulatedBmi ?? null, testScore: r.correctCount, gameScore: r.score,
    demo: r.demo, contentVersion: r.contentVersion };
}

export class InvalidPayload extends Error {}
export function normalizeFeedbackComment(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > FEEDBACK_COMMENT_LIMIT) throw new InvalidPayload('ความคิดเห็นต้องเป็นข้อความไม่เกิน 1,000 ตัวอักษร');
  return value.trim() || undefined;
}
function fail(): never { throw new InvalidPayload('ข้อมูลไม่ถูกต้อง'); }
function obj(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(); return v as Record<string, unknown>; }
function str(v: unknown, max = 200): string { if (typeof v !== 'string' || !v.length || v.length > max) fail(); return v; }
function num(v: unknown, max: number, integer = false): number { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max || (integer && !Number.isInteger(v))) fail(); return v; }
function bool(v: unknown): boolean { if (typeof v !== 'boolean') fail(); return v; }
function choice<T extends string>(v: unknown, allowed: readonly T[]): T { if (!allowed.includes(v as T)) fail(); return v as T; }
function time(v: unknown): string { const s = str(v, 40); if (!/^\d{4}-\d{2}-\d{2}T/.test(s) || !Number.isFinite(Date.parse(s))) fail(); return s; }
function bmi(v: unknown): number | null { if (v == null) return null; const result = num(v, 1000); if (!result) fail(); return result; }
export function uuid(v: unknown): string { const s = str(v, 36); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) fail(); return s; }
export function validatePayload(input: unknown): CloudPayload {
  const p = obj(input);
  if (p.kind === 'feedback' || p.kind === 'event') {
    const common = { contextRunId: uuid(p.contextRunId), surveyVersion: choice(p.surveyVersion, [SURVEY_VERSION]), occurredAt: time(p.occurredAt) };
    if (p.kind === 'event') return { ...common, kind: 'event', eventId: uuid(p.eventId), event: choice(p.event, ['shown', 'skipped']) };
    const rating = num(p.rating, 5, true); if (rating < 1) fail();
    const eligibleRunCount = num(p.eligibleRunCount, 1_000_000, true); if (eligibleRunCount < SURVEY_INTERVAL) fail();
    const comment = normalizeFeedbackComment(p.comment);
    return { ...common, kind: 'feedback', rating, ...(comment ? { comment } : {}), eligibleRunCount };
  }
  if (p.kind !== 'run') fail();
  const r = obj(p.run), startedAt = time(r.startedAt), endedAt = time(r.endedAt);
  if (Date.parse(endedAt) < Date.parse(startedAt)) fail();
  // Already queued v1 runs carry correctCount/score/ageYearsAtStart; unknown fields are discarded.
  const legacy = !('gameScore' in r);
  return { kind: 'run', run: { runId: uuid(r.runId), startedAt, endedAt,
    outcome: choice(r.outcome, ['completed', 'game_over', 'abandoned']),
    playerName: r.playerName == null ? null : str(r.playerName, 80),
    sex: r.sex == null ? null : choice<Profile['sex']>(r.sex, ['male', 'female']),
    ageYears: num(legacy ? r.ageYearsAtStart : r.ageYears, 150, true),
    bmiStart: bmi(r.bmiStart), bmiEnd: bmi(r.bmiEnd),
    testScore: num(legacy ? r.correctCount : r.testScore, 10, true),
    gameScore: num(legacy ? r.score : r.gameScore, 1_000_000, true), demo: bool(r.demo), contentVersion: str(r.contentVersion) } };
}
