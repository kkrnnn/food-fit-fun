import { isExercise, createItemLayout } from './ItemCatalog';
import { estimateExerciseEnergy, exerciseDeduction, netGameEnergy } from './ExerciseEnergy';
import { FOOD_NUTRITION, NUTRITION_VERSION } from './FoodNutrition';
import { estimateEnergy, gameBodyWidth } from '../../features/health/energy';
import { validateProfile } from '../../features/health/assessment';
import { jumpProgress, jumpHeight, GROUND_CLEARANCE_HEIGHT, JUMP_COOLDOWN_MS } from './JumpArc';
import type { Lane, InputMode, PlannedQuestion, Profile, RunRecord, SceneItem, Snapshot, Phase, Outcome } from './types';

export const COURSE_SPEED = 16;
export const TARGET_RUN_SECONDS = 180;
export const LEVEL_DISTANCE = COURSE_SPEED * TARGET_RUN_SECONDS;
export const GATE_SPACING = LEVEL_DISTANCE / 10;
export const QUIZ_SECONDS = 6;
export const QUIZ_APPROACH_DISTANCE = COURSE_SPEED * QUIZ_SECONDS;
export const COURSE_VIEW_DISTANCE = COURSE_SPEED * 14;
export const LEVEL_VERSION = 'learning-camera-exercise-grace-v10';
export const SCORING_VERSION = 'learning-distance-1500-v3';
// Pose frames arrive after the physical motion. Keep exercise pickups forgiving
// without changing the jump arc or the ground-food collision rule.
export const CAMERA_EXERCISE_EARLY_MS = 1100;
export const CAMERA_EXERCISE_LATE_MS = 250;

/** Owns every gameplay rule; rendering and input adapters send commands here. */
export class RunSession {
  private jumpStarted = -Infinity;
  private pendingExercises: { item: SceneItem; expiresAt: number }[] = [];
  jump(): boolean {
    if (this.paused || !this.controlValid || this.phase === 'terminal' || this.record.activePlayMs-this.jumpStarted < JUMP_COOLDOWN_MS) return false;
    this.jumpStarted=this.record.activePlayMs; this.record.jumpAttempts=(this.record.jumpAttempts ?? 0)+1;
    this.resolvePendingExercises();
    return true;
  }
  private phase: Phase = 'running';
  private paused = false;
  private lane: Lane = 1;
  private wrongStreak = 0;
  private questionIndex = 0;
  private selectionMs = 0;
  private feedbackMs = 0;
  private laneStableMs = 0;
  private controlValid = true;
  private trackingPause = false;
  private feedback = '';
  private processed = new Set<string>();
  private items: SceneItem[] = [];
  private record: RunRecord;
  private events: RunEvent[] = [];
  drainEvents(): RunEvent[] { const events = this.events; this.events = []; return events; }

  constructor(profile: Profile, questions: PlannedQuestion[], options: { runId: string; startedAt: string; seed: number; demo: boolean; contentVersion: string; blueprintVersion: string; mode: InputMode }) {
    if (questions.length !== 10 || new Set(questions.map(q => q.question.questionId)).size !== 10) throw new Error('รอบต้องมี 10 คำถามที่ไม่ซ้ำ');
    const errors = validateProfile(profile);
    if (errors.length) throw new Error(errors.join(' · '));
    const energy = estimateEnergy(profile);
    this.controlValid = options.mode === 'manual';
    this.record = {
      schemaVersion: 2, runId: options.runId, playerId: profile.playerId, startedAt: options.startedAt,
      outcome: 'in_progress', ageMonthsAtStart: profile.ageMonths, agePrecision: profile.agePrecision ?? 'months', profileVersion: profile.version,
      playerNameAtStart: profile.nickname, sexAtStart: profile.sex,
      levelVersion: LEVEL_VERSION, scoringVersion: SCORING_VERSION, contentVersion: options.contentVersion, blueprintVersion: options.blueprintVersion,
      seed: options.seed, demo: options.demo, plannedQuestions: structuredClone(questions), answers: [], distance: 0, activePlayMs: 0,
      ...energy, nutritionVersion: NUTRITION_VERSION, foodIntakeKcal: 0, collectedFoods: [], exerciseKcal: 0, ...estimateExerciseEnergy(profile), collectedExercises: [],
      correctCount: 0, incorrectCount: 0, unreachedCount: 10, maxWrongStreak: 0, score: 0,
      inputModeGroup: options.mode, inputTimeline: [{ mode: options.mode, atMs: 0 }], trackingPauseCount: 0, trackingPauseMs: 0, itemCounts: {},
    };
    this.items = createItemLayout(options.seed, GATE_SPACING);
  }

  setLane(lane: Lane, valid = true): void {
    if (!Number.isInteger(lane) || lane < 0 || lane > 2 || this.phase === 'terminal') return;
    if (lane !== this.lane || !valid) this.laneStableMs = 0;
    this.lane = lane;
    this.controlValid = valid;
    if (!valid) this.cancelPendingExercises();
    else this.resolvePendingExercises();
  }
  invalidateControl(): void { this.cancelPendingExercises(); this.jumpStarted=-Infinity; this.controlValid = false; this.laneStableMs = 0; }
  setInputMode(mode: InputMode): void {
    if (this.phase === 'terminal') return;
    if (this.record.inputTimeline[this.record.inputTimeline.length - 1]?.mode === mode) return;
    this.cancelPendingExercises(); this.jumpStarted=-Infinity;
    this.record.inputTimeline.push({ mode, atMs: this.record.activePlayMs });
    this.record.inputModeGroup = 'mixed';
    this.controlValid = mode === 'manual';
    this.laneStableMs = 0;
  }
  pause(tracking = false): void {
    if (this.paused || this.phase === 'terminal') return;
    this.cancelPendingExercises(); this.jumpStarted=-Infinity;
    this.paused = true;
    this.trackingPause = tracking;
    if (tracking) this.record.trackingPauseCount++;
    this.laneStableMs = 0;
  }
  resume(): void { this.paused = false; this.trackingPause = false; this.laneStableMs = 0; }
  continueAfterFeedback(): void {
    if (this.paused || this.phase !== 'quiz_feedback') return;
    this.phase = 'running'; this.feedback = ''; this.feedbackMs = 0;
  }
  advance(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.phase === 'terminal') return;
    const ms = seconds * 1000;
    if (this.paused) { if (this.trackingPause) this.record.trackingPauseMs += ms; return; }
    if (this.controlValid) this.laneStableMs += ms;
    if (!['running', 'quiz_approach', 'quiz_feedback'].includes(this.phase) || !this.controlValid) return;
    if (this.phase === 'quiz_feedback') {
      this.feedbackMs = Math.max(0, this.feedbackMs - ms);
      if (!this.feedbackMs) this.continueAfterFeedback();
    }
    const nextGate = this.questionIndex < 10 ? (this.questionIndex + 1) * GATE_SPACING : LEVEL_DISTANCE;
    const approach = this.phase === 'quiz_approach';
    const checkpoint = approach ? nextGate : this.questionIndex < 10 ? nextGate - QUIZ_APPROACH_DISTANCE : LEVEL_DISTANCE;
    const end = Math.min(checkpoint, this.record.distance + seconds * COURSE_SPEED);
    const before = this.record.distance;
    const events = approach ? [] : this.items.filter(item => item.distance > this.record.distance && item.distance <= end && !this.processed.has(item.id));
    const distances = [...new Set(events.map(e => e.distance))].sort((a, b) => a - b);
    for (const d of distances) {
      this.travel(d);
      const row = events.filter(e => e.distance === d);
      const chosen = row.find(e => e.lane === this.lane);
      row.forEach(e => this.processed.add(e.id));
      const airborne = jumpHeight(jumpProgress(this.record.activePlayMs - this.jumpStarted)) >= GROUND_CLEARANCE_HEIGHT;
      if (chosen && isExercise(chosen.type) && this.cameraInput()) {
        const elapsed = this.record.activePlayMs - this.jumpStarted;
        if (elapsed >= 0 && elapsed <= CAMERA_EXERCISE_EARLY_MS) this.applyItem(chosen);
        else this.pendingExercises.push({ item: chosen, expiresAt: this.record.activePlayMs + CAMERA_EXERCISE_LATE_MS });
      } else if (chosen && (isExercise(chosen.type) ? airborne : !airborne)) this.applyItem(chosen);
      else if (row.some(e => isExercise(e.type))) this.missExercise();

    }
    this.travel(end);
    if (approach) this.selectionMs += (end - before) / COURSE_SPEED * 1000;
    if (end === checkpoint) {
      if (this.questionIndex >= 10) this.endRun('completed', 'finish');
      else if (approach) { if (this.laneStableMs >= 300) this.resolveAnswer(); }
      else { this.phase = 'quiz_approach'; this.selectionMs = 0; this.feedback = ''; }
    }
  }
  private travel(to: number): void {
    const delta = to - this.record.distance;
    this.record.activePlayMs += delta / COURSE_SPEED * 1000;
    this.record.distance = to;
    this.resolvePendingExercises();
  }
  private cameraInput(): boolean { return this.record.inputTimeline[this.record.inputTimeline.length - 1].mode === 'camera'; }
  private missExercise(): void { this.record.exerciseMissed = (this.record.exerciseMissed ?? 0) + 1; }
  private cancelPendingExercises(): void {
    this.pendingExercises.forEach(() => this.missExercise());
    this.pendingExercises = [];
  }
  private resolvePendingExercises(): void {
    this.pendingExercises = this.pendingExercises.filter(({ item, expiresAt }) => {
      if (this.record.activePlayMs > expiresAt || this.lane !== item.lane) { this.missExercise(); return false; }
      // A fresh jump must begin while the late grace is still open.
      const crossedAt = expiresAt - CAMERA_EXERCISE_LATE_MS;
      if (this.cameraInput() && this.controlValid && this.jumpStarted >= crossedAt && this.jumpStarted <= expiresAt) { this.applyItem(item); return false; }
      return true;
    });
  }
  private applyItem(item: SceneItem): void {
    this.record.itemCounts[item.type] = (this.record.itemCounts[item.type] ?? 0) + 1;
    const food = FOOD_NUTRITION[item.type];
    const deltaKcal = food ? food.kcalPerPortion : exerciseDeduction(item.type,this.record.exerciseEstimates) === null ? null : -exerciseDeduction(item.type,this.record.exerciseEstimates)!;
    if (!food && !isExercise(item.type)) throw new Error('ไม่มีข้อมูลพลังงานของอาหารนี้');
    if (food) {
      this.record.foodIntakeKcal! += food.kcalPerPortion;
      const saved = this.record.collectedFoods!.find(f => f.foodId === item.type);
      if (saved) saved.count++;
      else this.record.collectedFoods!.push({ foodId: item.type, name: food.name, portionLabel: food.portionLabel, kcalPerPortion: food.kcalPerPortion, count: 1 });
    }
    if (isExercise(item.type)) {
      this.record.exerciseKcal! += exerciseDeduction(item.type,this.record.exerciseEstimates) ?? 0;
      const saved=this.record.collectedExercises!.find(e=>e.itemType===item.type);
      if(saved)saved.count++;
      else this.record.collectedExercises!.push({itemType:item.type,count:1,...this.record.exerciseEstimates![item.type],kcalPerPickup:exerciseDeduction(item.type,this.record.exerciseEstimates)});
    }
    this.feedback = '';
    this.events.push({ kind: 'item', id: item.id, type: item.type, deltaKcal });
  }

  private resolveAnswer(): void {
    const planned = this.record.plannedQuestions[this.questionIndex];
    const q = planned.question;
    const selected = planned.options[this.lane].optionId;
    const correct = selected === q.correctOptionId;
    this.wrongStreak = correct ? 0 : this.wrongStreak + 1;
    this.record.maxWrongStreak = Math.max(this.record.maxWrongStreak, this.wrongStreak);
    this.record.answers.push({ index: this.questionIndex, questionId: q.questionId, revision: q.revision, topic: q.topic,
      difficulty: q.difficulty, prompt: q.prompt, options: structuredClone(planned.options), selectedOptionId: selected,
      correctOptionId: q.correctOptionId, explanation: q.explanation, isCorrect: correct, wrongStreakAfter: this.wrongStreak,
      checkpoint: (this.questionIndex + 1) * GATE_SPACING, readMs: 0, selectionMs: this.selectionMs,
      exposureCount: planned.exposureCount, isFirstExposure: planned.exposureCount === 1,
    });
    this.events.push({ kind: 'answer', id: `${this.record.runId}:${this.questionIndex}`, correct });
    if (correct) this.record.correctCount++; else this.record.incorrectCount++;
    this.record.unreachedCount = 10 - this.record.answers.length;
    this.phase = 'quiz_feedback'; this.feedbackMs = 2500;
    if (this.wrongStreak === 3) this.endRun('game_over', 'three_consecutive_wrong');
    else {
      this.questionIndex++;
      if (this.questionIndex === 10) this.endRun('completed', 'finish');
    }
  }
  endRun(outcome: Exclude<Outcome, 'in_progress'>, reason: string, endedAt = new Date().toISOString()): void {
    if (this.phase === 'terminal') return;
    this.phase = 'terminal'; this.paused = false;
    this.record.outcome = outcome; this.record.endReason = reason; this.record.endedAt = endedAt;
    this.record.score = this.record.correctCount * 100 + Math.round(this.record.distance / LEVEL_DISTANCE * 200) + (outcome === 'completed' ? 300 : 0);
  }
  visibleItems(): SceneItem[] {
    if (this.phase === 'terminal') return [];
    // Visibility is independent of quiz state: food beyond the gate stays in the scene.
    return this.items.filter(e => this.pendingExercises.some(p => p.item.id === e.id) || (!this.processed.has(e.id) && e.distance > this.record.distance && e.distance - this.record.distance <= COURSE_VIEW_DISTANCE));
  }
  snapshot(): Snapshot {
    return structuredClone({ jumpProgress: jumpProgress(this.record.activePlayMs-this.jumpStarted),
      foodIntakeKcal: this.record.foodIntakeKcal!, exerciseKcal: this.record.exerciseKcal ?? 0,
      netEnergyKcal: netGameEnergy(this.record.foodIntakeKcal!, this.record.exerciseKcal,this.record.collectedExercises?.some(e=>e.kcalPerPickup===null)), dailyEnergyKcal: this.record.dailyEnergyKcal ?? null,
      energyReason: this.record.energyReason ?? '', characterWidthScale: gameBodyWidth(netGameEnergy(this.record.foodIntakeKcal ?? 0, this.record.exerciseKcal,this.record.collectedExercises?.some(e=>e.kcalPerPickup===null)) ?? 0, this.record.dailyEnergyKcal ?? null), phase: this.phase, paused: this.paused, distance: this.record.distance,
      lane: this.lane, wrongStreak: this.wrongStreak, questionIndex: this.questionIndex,
      question: this.record.plannedQuestions[this.questionIndex], lastAnswer: this.record.answers[this.record.answers.length - 1],
      approachProgress: this.selectionMs / (QUIZ_SECONDS * 1000),
      waitingForLane: this.phase === 'quiz_approach' && this.record.distance === (this.questionIndex + 1) * GATE_SPACING && (!this.controlValid || this.laneStableMs < 300),
      feedback: this.feedback, record: this.record });
  }
}

export type RunEvent = { kind: 'item'; id: string; type: SceneItem['type']; deltaKcal: number | null } | { kind: 'answer'; id: string; correct: boolean };
