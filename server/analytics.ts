import { InvalidPayload, uuid, validatePayload } from '../src/features/analytics/cloudContract.js';

export interface AnalyticsEnv {
  SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string; ANALYTICS_HASH_SECRET?: string;
  ANALYTICS_ENABLED?: string; ANALYTICS_ORIGINS?: string;
}
declare const process: { env: AnalyticsEnv };
export function environment(): AnalyticsEnv { return process.env; }
function configured(env: AnalyticsEnv): boolean {
  return env.ANALYTICS_ENABLED === 'true' && !!env.SUPABASE_URL?.startsWith('https://') && !!env.SUPABASE_SECRET_KEY &&
    (env.ANALYTICS_HASH_SECRET?.length ?? 0) >= 32 && !!env.ANALYTICS_ORIGINS;
}
async function sha(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
function response(status: number, body: object): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
async function boundedJson(req: Request): Promise<unknown> {
  const max = 100_000;
  if (Number(req.headers.get('content-length') || 0) > max) throw new RangeError();
  const reader = req.body?.getReader(); if (!reader) throw new InvalidPayload();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength; if (size > max) { await reader.cancel(); throw new RangeError(); } chunks.push(result.value);
    }
    const joined = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(joined));
  } finally { reader.releaseLock(); }
}
export async function handleAnalytics(req: Request, route: 'runs' | 'feedback', env: AnalyticsEnv = environment(), send: typeof fetch = fetch): Promise<Response> {
  if (req.method === 'GET' && route === 'runs') return response(configured(env) ? 200 : 503, { enabled: configured(env) });
  if (req.method !== 'POST') return response(405, { error: 'method_not_allowed' });
  if (!configured(env)) return response(503, { error: 'not_configured' });
  const origin = req.headers.get('origin');
  // Origin reduces browser misuse; the private token, DB ownership and rate limits enforce submission scope.
  if (!origin || !env.ANALYTICS_ORIGINS!.split(',').map(s => s.trim()).includes(origin)) return response(403, { error: 'origin_denied' });
  if (!req.headers.get('content-type')?.startsWith('application/json')) return response(415, { error: 'json_required' });
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return response(401, { error: 'invalid_identity' });
  let playerId: string, payload;
  try { playerId = uuid(req.headers.get('x-analytics-player')); payload = validatePayload(await boundedJson(req)); }
  catch (err) { return response(err instanceof RangeError ? 413 : 400, { error: 'invalid_payload' }); }
  if ((route === 'runs') !== (payload.kind === 'run')) return response(400, { error: 'wrong_route' });
  if (payload.kind === 'event') return response(200, { ok: true }); // Retired v1 client events, no cloud rows.
  try {
    const upstream = await send(`${env.SUPABASE_URL!.replace(/\/$/, '')}/rest/v1/rpc/score_feedback_ingest`, {
      method: 'POST', headers: { apikey: env.SUPABASE_SECRET_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_player_id: playerId, p_token_hash: await sha(`${env.ANALYTICS_HASH_SECRET}:token:${token}`), p_payload: payload }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) return response(502, { error: 'database_unavailable' });
    const result = await upstream.json();
    if (result === 'ok') return response(200, { ok: true });
    if (result === 'rate_limited') return response(429, { error: 'rate_limited' });
    if (result === 'missing_run') return response(409, { error: 'missing_run' });
    if (result === 'forbidden') return response(403, { error: 'identity_denied' });
    if (result === 'ineligible') return response(422, { error: 'ineligible' });
    if (result === 'invalid') return response(400, { error: 'invalid_payload' });
    return response(502, { error: 'database_unavailable' });
  } catch { return response(502, { error: 'database_unavailable' }); }
}
