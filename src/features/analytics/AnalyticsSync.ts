import type { RunRepository } from './RunRepository';

export type SyncStatus = 'checking' | 'unconfigured' | 'offline' | 'pending' | 'synced' | 'error';
export class AnalyticsSync {
  private running: Promise<SyncStatus> | null = null;
  // Native browser fetch requires its global receiver, rather than this class instance.
  constructor(private repository: RunRepository, private send: typeof fetch = (input, init) => fetch(input, init),
    private now = () => Date.now(), private random = () => Math.random()) {}
  flush(): Promise<SyncStatus> {
    if (!this.running) this.running = this.deliver().finally(() => { this.running = null; });
    return this.running;
  }
  private async deliver(): Promise<SyncStatus> {
    const { outbox } = await this.repository.analyticsData();
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
    let acceptsEnergy = false;
    let acceptsExercise = false;
    try {
      const config = await this.send('/api/analytics/runs', { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
      if (config.status === 503 || config.status === 404) return 'unconfigured';
      if (!config.ok) return 'error';
      // Vite/static hosts may serve the SPA HTML fallback at an absent API route.
      if (!config.headers.get('content-type')?.includes('application/json')) return 'unconfigured';
      const body = await config.json(); if (body.enabled !== true) return 'unconfigured';
      acceptsEnergy = body.runSchemaVersion === 2;
      acceptsExercise = body.exerciseEnergyVersion === 2;
    } catch { return 'error'; }
    // Retire previously queued impression/skip events locally. Only scores and submitted stars leave the device.
    for (const item of outbox.filter(e => e.payload.kind === 'event' && e.state !== 'synced')) {
      await this.repository.updateDelivery(item.id, { state: 'synced', attempts: item.attempts, nextAttemptAt: 0, error: undefined });
    }
    const pending = outbox.filter(e => e.state !== 'synced' && e.payload.kind !== 'event');
    // Runs are sent first; their dependent impressions and rating wait for an acknowledged run.
    pending.sort((a, b) => Number(b.payload.kind === 'run') - Number(a.payload.kind === 'run') || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    const deliveredRuns = new Set(outbox.filter(e => e.state === 'synced' && e.payload.kind === 'run').map(e => e.payload.kind === 'run' ? e.payload.run.runId : ''));
    let sent = 0, failed = pending.some(e => e.state === 'blocked');
    for (const item of pending) {
      if (item.state === 'blocked' || item.nextAttemptAt > this.now() || sent >= 20) continue;
      // Older APIs discard unknown fields. Keep kcal runs queued until the new contract is available.
      if (item.payload.kind === 'run' && item.payload.run.runSchemaVersion === 2 && !acceptsEnergy) continue;
      if (item.payload.kind === 'run' && item.payload.run.exerciseModelVersion && !acceptsExercise) continue;
      if (item.payload.kind !== 'run' && !deliveredRuns.has(item.payload.contextRunId)) continue;
      // Another tab may have cleared local data or delivered the row since this batch began.
      const current = await this.repository.analyticsData();
      const latest = current.outbox.find(e => e.id === item.id);
      if (!latest || latest.state !== 'pending' || latest.nextAttemptAt > this.now()) continue;
      const identity = current.identities.find(i => i.playerId === item.playerId); if (!identity) { failed = true; continue; }
      sent++;
      let status = 0;
      try {
        const response = await this.send(`/api/analytics/${item.payload.kind === 'run' ? 'runs' : 'feedback'}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${identity.token}`, 'X-Analytics-Player': identity.analyticsPlayerId },
          body: JSON.stringify(item.payload), signal: AbortSignal.timeout(10_000),
        });
        status = response.status;
        if (response.ok) {
          const ack = await response.json(); if (ack.ok !== true) throw new Error('missing acknowledgement');
          await this.repository.updateDelivery(item.id, { state: 'synced', attempts: item.attempts, nextAttemptAt: 0, error: undefined });
          if (item.payload.kind === 'run') deliveredRuns.add(item.payload.run.runId);
          continue;
        }
      } catch { status = 0; }
      failed = true;
      const blocked = status >= 400 && status < 500 && ![408, 409, 429].includes(status);
      const delay = Math.min(3_600_000, 5000 * 2 ** Math.min(item.attempts, 10)) * (.75 + this.random() * .5);
      await this.repository.updateDelivery(item.id, { state: blocked ? 'blocked' : 'pending', attempts: item.attempts + 1,
        nextAttemptAt: this.now() + delay, error: blocked ? `ข้อมูลถูกปฏิเสธ (${status})` : `รอส่งใหม่ (${status || 'เครือข่าย'})` });
      if ([0, 429, 503].includes(status)) break;
    }
    const remaining = (await this.repository.analyticsData()).outbox.some(e => e.state !== 'synced');
    return failed ? 'error' : remaining ? 'pending' : 'synced';
  }
}
export function deliveryText(status: SyncStatus, hasRecords = true): string {
  switch (status) {
    case 'checking': return 'กำลังตรวจการส่งข้อมูล…';
    case 'unconfigured': return 'บันทึกในเครื่องแล้ว · ยังไม่ได้ตั้งค่า Supabase';
    case 'offline': return 'บันทึกในเครื่องแล้ว · รออินเทอร์เน็ตเพื่อส่ง';
    case 'pending': return 'บันทึกในเครื่องแล้ว · รอส่งข้อมูลส่วนกลาง';
    case 'synced': return hasRecords ? 'ส่งข้อมูลส่วนกลางแล้ว' : 'พร้อมส่งข้อมูลส่วนกลาง · ยังไม่มีผลใหม่';
    case 'error': return 'บันทึกในเครื่องแล้ว · ส่งข้อมูลส่วนกลางไม่สำเร็จ';
  }
}
