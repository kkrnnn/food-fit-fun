export type Sensitivity = 'gentle' | 'normal' | 'steady';
export interface CameraTuning { lane: Sensitivity; jump: Sensitivity }
export const DEFAULT_CAMERA_TUNING: CameraTuning = { lane: 'normal', jump: 'normal' };
const STORAGE_KEY = 'food-fit-fun:camera-tuning-v1';
export const LANE_TUNING = {
  gentle: { enter: .45, exit: .26, smoothingMs: 60 },
  normal: { enter: .6, exit: .35, smoothingMs: 80 },
  steady: { enter: .8, exit: .46, smoothingMs: 110 },
};
export const JUMP_TUNING = { gentle: .09, normal: .12, steady: .16 };
export function normalizeCameraTuning(value: unknown): CameraTuning {
  const settings = value && typeof value === 'object' ? value as Partial<CameraTuning> : {};
  const valid = (value: unknown): value is Sensitivity => value === 'gentle' || value === 'normal' || value === 'steady';
  return { lane: valid(settings.lane) ? settings.lane : 'normal', jump: valid(settings.jump) ? settings.jump : 'normal' };
}
export function readCameraTuning(): CameraTuning {
  try { return normalizeCameraTuning(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); }
  catch { return { ...DEFAULT_CAMERA_TUNING }; }
}
export function saveCameraTuning(value: CameraTuning): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeCameraTuning(value))); return true; }
  catch { return false; }
}
