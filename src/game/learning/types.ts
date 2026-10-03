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
export interface RunRecord {
  schemaVersion: 1;
  runId: string;
  playerId: string;
  startedAt: string;
  endedAt?: string;
  outcome: Outcome;
  endReason?: string;
  ageMonthsAtStart: number;
  agePrecision?: 'years' | 'months';
  profileVersion: number;
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
  balance: number;
  balancedDistance: number;
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
  initialBmi: number;
  simulatedBmi: number;
  characterWidthScale: number;
  phase: Phase;
  paused: boolean;
  distance: number;
  balance: number;
  balancedDistance: number;
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
