import type { ExerciseEstimate } from './ExerciseEnergy';
export type Lane = 0 | 1 | 2;
export type InputMode = 'camera' | 'manual';
export type Outcome = 'in_progress' | 'completed' | 'game_over' | 'abandoned';
export interface Profile {
  playerId: string;
  nickname: string;
  version: number;
  sex: 'male' | 'female';
  ageMonths: number;
  heightCm: number;
  weightKg: number;
  activity: 'inactive' | 'low' | 'active' | 'very' | '';
  avatar: 'mint' | 'rose' | 'amber';
  agePrecision?: 'years' | 'months';
}
export interface Question {
  questionId: string;
  revision: number;
  topic: string;
  difficulty: 'easy' | 'medium';
  ageRange: [number, number | null]; // inclusive/exclusive months
  learningObjective: string;
  prompt: string;
  options: { optionId: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  source: string;
  reviewStatus: 'draft' | 'reviewed';
}
export interface QuestionBank {
  schemaVersion: 1 | 2;
  contentVersion: string;
  blueprintVersion: string;
  questions: Question[];
}
export interface DeckState {
  contentVersion: string;
  counts: Record<string, number>;
}
export interface PlannedQuestion {
  question: Question;
  options: Question['options'];
  exposureCount: number;
}
export interface Answer {
  index: number;
  questionId: string;
  revision: number;
  topic: string;
  difficulty: string;
  prompt: string;
  options: Question['options'];
  selectedOptionId: string;
  correctOptionId: string;
  explanation: string;
  isCorrect: boolean;
  wrongStreakAfter: number;
  checkpoint: number;
  readMs: number;
  selectionMs: number;
  exposureCount: number;
  isFirstExposure: boolean;
}
export interface CollectedFood {
  foodId: import('./ItemCatalog').ItemType;
  name: string;
  portionLabel: string;
  kcalPerPortion: number;
  count: number;
}
export interface CollectedExercise extends Partial<ExerciseEstimate> {
  itemType: import('./ItemCatalog').ItemType;
  count: number;
  kcalPerPickup: number | null;
}
export interface RunRecord {
  schemaVersion: 1 | 2;
  runId: string;
  playerId: string;
  startedAt: string;
  endedAt?: string;
  outcome: Outcome;
  endReason?: string;
  ageMonthsAtStart: number;
  agePrecision?: 'years' | 'months';
  profileVersion: number;
  playerNameAtStart?: string;
  sexAtStart?: Profile['sex'];
  levelVersion: string;
  scoringVersion: string;
  contentVersion: string;
  blueprintVersion: string;
  seed: number;
  demo: boolean;
  plannedQuestions: PlannedQuestion[];
  answers: Answer[];
  distance: number;
  activePlayMs: number;
  initialBmi?: number;
  simulatedBmi?: number;
  bodyModelVersion?: string;
  energyModelVersion?: string;
  activityAssumption?: 'inactive';
  dailyEnergyKcal?: number | null;
  energyStatus?: 'available' | 'unavailable';
  energyReason?: string;
  nutritionVersion?: string;
  foodIntakeKcal?: number;
  collectedFoods?: CollectedFood[];
  exerciseKcal?: number;
  exerciseModelVersion?: string;
  exerciseEnergyStatus?: 'available' | 'unavailable';
  exerciseEnergyReason?: string;
  exerciseEstimates?: Partial<Record<import('./ItemCatalog').ItemType,ExerciseEstimate>>;
  collectedExercises?: CollectedExercise[];
  balance?: number;
  balancedDistance?: number;
  correctCount: number;
  incorrectCount: number;
  unreachedCount: number;
  maxWrongStreak: number;
  score: number;
  inputModeGroup: InputMode | 'mixed';
  inputTimeline: { mode: InputMode; atMs: number }[];
  trackingPauseCount: number;
  trackingPauseMs: number;
  jumpAttempts?: number;
  exerciseMissed?: number;
  itemCounts: Record<string, number>;
}
export type Phase = 'running' | 'quiz_approach' | 'quiz_feedback' | 'terminal';
export interface SceneItem { id: string; type: import('./ItemCatalog').ItemType; lane: Lane; distance: number; meal?: boolean }
export interface Snapshot {
  motionSpeed?: number;
  jumpProgress?: number;
  foodIntakeKcal: number;
  exerciseKcal: number;
  netEnergyKcal: number | null;
  dailyEnergyKcal: number | null;
  energyReason: string;
  characterWidthScale: number;
  phase: Phase;
  paused: boolean;
  distance: number;
  lane: Lane;
  wrongStreak: number;
  questionIndex: number;
  question?: PlannedQuestion;
  lastAnswer?: Answer;
  approachProgress: number;
  waitingForLane: boolean;
  feedback: string;
  record: RunRecord;
}
