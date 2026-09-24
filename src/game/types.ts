export interface BodyStatus {
  energy: number;   // 0 - 100
  sugar: number;    // 0 - 100
  stamina: number;  // 0 - 100
  mood: number;     // 0 - 100
}

export type BreakfastOption = 'DONUT' | 'OATMEAL' | 'EGG';

export type ItemType = 
  | 'BURGER' 
  | 'COLA' 
  | 'APPLE' 
  | 'WATER' 
  | 'ENERGY_DRINK' 
  | 'EXERCISE' 
  | 'SLEEP';

export type BossType = 'NONE' | 'SUGAR_BEAST' | 'COUCH_MONSTER' | 'ENERGY_CRASH';

export type GameState = 
  | 'MENU' 
  | 'BREAKFAST' 
  | 'RUNNING' 
  | 'DECISION_GATE' 
  | 'BOSS_BATTLE' 
  | 'GAME_OVER' 
  | 'VICTORY';

export interface DecisionDoor {
  id: string;
  title: string;
  subtitle: string;
  type: 'FAST_FOOD' | 'HEALTHY' | 'MYSTERY';
  icon: string;
  statsEffect: string;
}

export interface HighScore {
  name: string;
  score: number;
  distance: number;
  lifestyle: string;
  date: string;
}

export interface ActiveCombo {
  type: 'HEALTHY' | 'CRASH' | 'NONE';
  count: number;
  multiplier: number;
  timer: number;
}
