export const TUTORIAL_VERSION = 'guided-transitions-jump-v2';
export interface TutorialStatus { status: 'completed' | 'skipped'; tutorialVersion: string; updatedAt: string }
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
/** Memory fallback prevents retries repeating lessons when device storage fails. */
export class TutorialMemory {
  private memory = new Map<string, TutorialStatus>();
  constructor(private storage: StorageLike | null) {}
  has(playerId: string): boolean {
    if (this.memory.has(playerId)) return true;
    try {
      const raw = this.storage?.getItem(this.key(playerId));
      if (!raw) return false;
      const value = JSON.parse(raw);
      if (value.status !== 'completed' && value.status !== 'skipped') return false;
      this.memory.set(playerId, value); return true;
    } catch { return false; }
  }
  needsUpgrade(playerId: string): boolean { return this.has(playerId) && this.memory.get(playerId)?.tutorialVersion !== TUTORIAL_VERSION; }
  finish(playerId: string, status: TutorialStatus['status']): boolean {
    const value = { status, tutorialVersion: TUTORIAL_VERSION, updatedAt: new Date().toISOString() };
    this.memory.set(playerId, value);
    try { if (!this.storage) return false; this.storage.setItem(this.key(playerId), JSON.stringify(value)); return true; } catch { return false; }
  }
  clear(playerId: string): void { this.memory.delete(playerId); try { this.storage?.removeItem(this.key(playerId)); } catch {} }
  private key(id: string) { return `food-fit-fun:tutorial:${id}`; }
}
