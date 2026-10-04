import type { RunRecord, Profile } from '../../game/learning/types';
import { FOOD_NUTRITION, NUTRITION_VERSION } from '../../game/learning/FoodNutrition.js';
import { ENERGY_MODEL_VERSION } from '../health/energy.js';
import type { CollectedFood } from '../../game/learning/types';
import { EXERCISE_MODEL_VERSION, ONE_MINUTE_EXERCISE_MODEL_VERSION, LEGACY_EXERCISE_MODEL_VERSION, exerciseReference, exerciseKcalForWeight, netGameEnergy } from '../../game/learning/ExerciseEnergy.js';
import type { CollectedExercise } from '../../game/learning/types';

export const SURVEY_VERSION = 'enjoyment-v1';
export const FEEDBACK_COMMENT_LIMIT = 1000;
export interface AnalyticsIdentity { playerId: string; analyticsPlayerId: string; token: string; }
export interface SurveyCounter { playerId: string; eligibleCount: number; }
export interface SurveyState { runId: string; playerId: string; status: 'pending' | 'submitted' | 'skipped' | 'historical'; rating?: number; comment?: string; }
export interface CloudRun {
  runId: string; startedAt: string; endedAt?: string; outcome: Exclude<RunRecord['outcome'], 'in_progress'>;
  playerName: string | null; sex: Profile['sex'] | null; ageYears: number;
  bmiStart: number | null; bmiEnd: number | null; testScore: number; gameScore: number;
  demo: boolean; contentVersion: string;
  runSchemaVersion?: 2;
  dailyEnergyKcal?: number | null;
  foodIntakeKcal?: number;
  energyStatus?: 'available' | 'unavailable';
  energyReason?: string;
  energyModelVersion?: string;
  activityAssumption?: 'inactive';
  nutritionVersion?: string;
  scoringVersion?: string;
  collectedFoods?: CollectedFood[];
  exerciseKcal?: number;
  netEnergyKcal?: number | null;
  exerciseEnergyStatus?: 'available' | 'unavailable';
  exerciseEnergyReason?: string;
  exerciseModelVersion?: string;
  collectedExercises?: CollectedExercise[];
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

/** Snapshot each metric in its own units; old BMI records are never backfilled as kcal. */
export function cloudRun(r: RunRecord): CloudRun {
  if (r.outcome === 'in_progress') throw new InvalidPayload('รอบยังไม่จบ');
  return { runId: r.runId, startedAt: r.startedAt, endedAt: r.endedAt, outcome: r.outcome,
    playerName: r.playerNameAtStart ?? null, sex: r.sexAtStart ?? null, ageYears: Math.floor(r.ageMonthsAtStart / 12),
    bmiStart: r.schemaVersion === 2 ? null : r.initialBmi ?? null, bmiEnd: r.schemaVersion === 2 ? null : r.simulatedBmi ?? null, testScore: r.correctCount, gameScore: r.score,
    demo: r.demo, contentVersion: r.contentVersion,
    ...(r.schemaVersion === 2 ? { runSchemaVersion: 2 as const, dailyEnergyKcal: r.dailyEnergyKcal ?? null,
      foodIntakeKcal: r.foodIntakeKcal, energyStatus: r.energyStatus, energyReason: r.energyReason,
      energyModelVersion: r.energyModelVersion, activityAssumption: r.activityAssumption,
      nutritionVersion: r.nutritionVersion, scoringVersion: r.scoringVersion,
      collectedFoods: structuredClone(r.collectedFoods ?? []),
      ...(r.exerciseModelVersion ? {exerciseModelVersion:r.exerciseModelVersion,exerciseKcal:r.exerciseKcal,
        netEnergyKcal:netGameEnergy(r.foodIntakeKcal!,r.exerciseKcal,r.collectedExercises?.some(e=>e.kcalPerPickup===null)),
        ...(r.exerciseEnergyStatus?{exerciseEnergyStatus:r.exerciseEnergyStatus,exerciseEnergyReason:r.exerciseEnergyReason}:{}),collectedExercises:structuredClone(r.collectedExercises ?? [])} : {}) } : {}) };
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
function energyFields(r: Record<string, unknown>): Partial<CloudRun> {
  const keys = ['dailyEnergyKcal', 'foodIntakeKcal', 'energyStatus', 'energyReason', 'energyModelVersion', 'activityAssumption', 'nutritionVersion', 'scoringVersion', 'collectedFoods','exerciseKcal','netEnergyKcal','exerciseModelVersion','collectedExercises','exerciseEnergyStatus','exerciseEnergyReason'];
  if (r.runSchemaVersion === undefined) {
    if (keys.some(key => key in r)) fail();
    return {};
  }
  if (r.runSchemaVersion !== 2 || r.bmiStart != null || r.bmiEnd != null) fail();
  const status = choice(r.energyStatus, ['available', 'unavailable'] as const);
  const daily = r.dailyEnergyKcal === null ? null : num(r.dailyEnergyKcal, 100_000);
  if ((status === 'available' && (daily === null || daily <= 0)) || (status === 'unavailable' && daily !== null)) fail();
  if (typeof r.energyReason !== 'string' || r.energyReason.length > 1000 || (status === 'unavailable' && !r.energyReason.length)) fail();
  if (!Array.isArray(r.collectedFoods) || r.collectedFoods.length > 12) fail();
  const foods: CollectedFood[] = r.collectedFoods.map(input => {
    const f = obj(input), id = choice(str(f.foodId), Object.keys(FOOD_NUTRITION) as CollectedFood['foodId'][]);
    const reference = FOOD_NUTRITION[id]!;
    const count = num(f.count, 100, true); if (!count) fail();
    if (f.name !== reference.name || f.portionLabel !== reference.portionLabel || f.kcalPerPortion !== reference.kcalPerPortion) fail();
    return { foodId: id, name: reference.name, portionLabel: reference.portionLabel, kcalPerPortion: reference.kcalPerPortion, count };
  });
  if (new Set(foods.map(f => f.foodId)).size !== foods.length || foods.reduce((sum, f) => sum + f.count, 0) > 100) fail();
  const intake = num(r.foodIntakeKcal, 1_000_000);
  if (Math.abs(intake - foods.reduce((sum, f) => sum + f.count * f.kcalPerPortion, 0)) > 0.000001) fail();
  const exerciseFields: Partial<CloudRun> = {};
  if(r.exerciseModelVersion !== undefined) {
    const version=choice(r.exerciseModelVersion,[EXERCISE_MODEL_VERSION,ONE_MINUTE_EXERCISE_MODEL_VERSION,LEGACY_EXERCISE_MODEL_VERSION]);
    exerciseFields.exerciseModelVersion=version;
    const legacy=version===LEGACY_EXERCISE_MODEL_VERSION;
    const duration=version===EXERCISE_MODEL_VERSION?15:1;
    const age=num(r.ageYears,150,true),sex=choice(r.sex,['male','female'] as const);
    const available=age>=6 && age<60;
    if(!legacy) {
      const status=choice(r.exerciseEnergyStatus,['available','unavailable'] as const);
      if((status==='available')!==available || typeof r.exerciseEnergyReason!=='string' || r.exerciseEnergyReason.length>1000 || (!available && !r.exerciseEnergyReason.length))fail();
      Object.assign(exerciseFields,{exerciseEnergyStatus:status,exerciseEnergyReason:r.exerciseEnergyReason});
    }
    if(!Array.isArray(r.collectedExercises) || r.collectedExercises.length>3)fail();
    let commonBaseline:number|undefined;
    const exercises: CollectedExercise[]=r.collectedExercises.map(input=>{
      const e=obj(input),itemType=choice(str(e.itemType),['SHOES','DUMBBELL','ROPE'] as const),count=num(e.count,10,true);
      if(!count)fail();
      if(legacy) {if(e.kcalPerPickup!==30)fail();return {itemType,count,kcalPerPickup:30};}
      const reference=exerciseReference(age,itemType,duration);
      if(e.durationMinutes!==duration || e.basis!=='gross' || e.estimated!==true)fail();
      if(!reference) {
        if(e.kcalPerPickup!==null || e.metValue!==null || e.metKind!==null || e.activityCode!=='' || e.activityLabel!==exerciseReference(10,itemType)!.activityLabel || e.sourceUrl!==exerciseReference(10,itemType)!.sourceUrl)fail();
        return {itemType,count,kcalPerPickup:null,durationMinutes:duration,basis:'gross',estimated:true,activityCode:'',metValue:null,metKind:null,activityLabel:e.activityLabel as string,sourceUrl:e.sourceUrl as string};
      }
      for(const key of ['activityCode','activityLabel','metValue','metKind','sourceUrl'] as const)if(e[key]!==reference[key])fail();
      const kcal=num(e.kcalPerPickup,100*duration);
      const low=exerciseKcalForWeight(age,sex,10,itemType)!*duration,high=exerciseKcalForWeight(age,sex,200,itemType)!*duration;
      if(kcal<low-1e-6 || kcal>high+1e-6)fail();
      const baseline=kcal/reference.metValue!;
      if(commonBaseline!==undefined && Math.abs(baseline-commonBaseline)>1e-6)fail();
      commonBaseline=baseline;
      return {itemType,count,kcalPerPickup:kcal,...reference};
    });
    const count=exercises.reduce((sum,e)=>sum+e.count,0),total=exercises.reduce((sum,e)=>sum+e.count*(e.kcalPerPickup??0),0);
    const exerciseKcal=num(r.exerciseKcal,1000*duration);
    if(count>10 || new Set(exercises.map(e=>e.itemType)).size!==exercises.length || Math.abs(exerciseKcal-total)>1e-6)fail();
    const net=netGameEnergy(intake,exerciseKcal,exercises.some(e=>e.kcalPerPickup===null));
    if(net===null ? r.netEnergyKcal!==null : typeof r.netEnergyKcal!=='number' || !Number.isFinite(r.netEnergyKcal) || Math.abs(r.netEnergyKcal-net)>1e-6)fail();
    Object.assign(exerciseFields,{exerciseKcal,netEnergyKcal:net,collectedExercises:exercises});
  } else if(['exerciseKcal','netEnergyKcal','collectedExercises','exerciseEnergyStatus','exerciseEnergyReason'].some(key=>key in r))fail();
  return { runSchemaVersion: 2, dailyEnergyKcal: daily, foodIntakeKcal: intake, energyStatus: status, energyReason: r.energyReason,
    energyModelVersion: choice(r.energyModelVersion, [ENERGY_MODEL_VERSION]), activityAssumption: choice(r.activityAssumption, ['inactive'] as const),
    nutritionVersion: choice(r.nutritionVersion, [NUTRITION_VERSION]), scoringVersion: choice(r.scoringVersion, ['learning-distance-1500-v3']), collectedFoods: foods,...exerciseFields };
}
export function uuid(v: unknown): string { const s = str(v, 36); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) fail(); return s; }
export function validatePayload(input: unknown): CloudPayload {
  const p = obj(input);
  if (p.kind === 'feedback' || p.kind === 'event') {
    const common = { contextRunId: uuid(p.contextRunId), surveyVersion: choice(p.surveyVersion, [SURVEY_VERSION]), occurredAt: time(p.occurredAt) };
    if (p.kind === 'event') return { ...common, kind: 'event', eventId: uuid(p.eventId), event: choice(p.event, ['shown', 'skipped']) };
    const rating = num(p.rating, 5, true); if (rating < 1) fail();
    const eligibleRunCount = num(p.eligibleRunCount, 1_000_000, true); if (eligibleRunCount < 1) fail();
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
    gameScore: num(legacy ? r.score : r.gameScore, 1_000_000, true), demo: bool(r.demo), contentVersion: str(r.contentVersion), ...energyFields(r) } };
}
