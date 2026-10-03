import { describe, expect, it, vi } from 'vitest';
import { handleAnalytics, type AnalyticsEnv } from './analytics';
const env: AnalyticsEnv={ANALYTICS_ENABLED:'true',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'SERVER SECRET',ANALYTICS_HASH_SECRET:'a'.repeat(64),ANALYTICS_ORIGINS:'https://game.example'};
const player='11111111-1111-4111-8111-111111111111',runId='22222222-2222-4222-8222-222222222222';
const payload={kind:'feedback',contextRunId:runId,surveyVersion:'enjoyment-v1',rating:4,eligibleRunCount:3,occurredAt:'2026-10-03T00:00:00Z'};
function req(body:unknown=payload,headers:Record<string,string>={}) {return new Request('https://game.example/api/analytics/feedback',{method:'POST',headers:{origin:'https://game.example','content-type':'application/json',authorization:`Bearer ${'b'.repeat(64)}`,'x-analytics-player':player,...headers},body:JSON.stringify(body)});}
describe('server analytics handler',()=>{
  it('forwards trimmed comments and rejects invalid comments before the database',async()=>{
    const send=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>Response.json('ok'));
    expect((await handleAnalytics(req({...payload,comment:'  เพิ่มอาหารหน่อย 🍎  '}),'feedback',env,send)).status).toBe(200);
    expect(JSON.parse(String(send.mock.calls[0][1]?.body)).p_payload.comment).toBe('เพิ่มอาหารหน่อย 🍎');
    send.mockClear();
    for(const comment of [null,{},'ก'.repeat(1001)])expect((await handleAnalytics(req({...payload,comment}),'feedback',env,send)).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
    expect((await handleAnalytics(req(),'feedback',env,async()=>Response.json('invalid'))).status).toBe(400);
  });
  it('reports missing config without pretending data was saved, and never serves a dataset',async()=>{
    expect((await handleAnalytics(new Request('https://game.example/api/analytics/runs'),'runs',{})).status).toBe(503);
    expect((await handleAnalytics(new Request('https://game.example/api/analytics/feedback'),'feedback',env)).status).toBe(405);
  });
  it('rejects wrong origins, missing credentials, invalid ratings and oversized bodies before database calls',async()=>{
    const send=vi.fn();
    expect((await handleAnalytics(req(payload,{origin:'https://attacker.example'}),'feedback',env,send)).status).toBe(403);
    expect((await handleAnalytics(req(payload,{authorization:''}),'feedback',env,send)).status).toBe(401);
    expect((await handleAnalytics(req({...payload,rating:0}),'feedback',env,send)).status).toBe(400);
    expect((await handleAnalytics(req({...payload,extra:'x'.repeat(100_000)}),'feedback',env,send)).status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });
  it('acknowledges retired v1 survey events without writing to Supabase',async()=>{
    const send=vi.fn();
    const event={...payload,kind:'event',eventId:'44444444-4444-4444-8444-444444444444',event:'shown'};
    expect((await handleAnalytics(req(event),'feedback',env,send)).status).toBe(200);expect(send).not.toHaveBeenCalled();
  });
  it('strips unknown fields, hashes credentials, maps ownership and rate-limit failures, and masks upstream errors',async()=>{
    const send=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>Response.json('ok'));
    const res=await handleAnalytics(req({...payload,weightKg:50}),'feedback',env,send);expect(res.status).toBe(200);expect(await res.json()).toEqual({ok:true});
    const options=send.mock.calls[0][1];const sent=JSON.parse(String(options?.body));
    expect(sent.p_payload).toEqual(payload);expect(send.mock.calls[0][0]).toBe('https://fixture.supabase.co/rest/v1/rpc/score_feedback_ingest');expect(sent).not.toHaveProperty('p_ip_hash');expect(sent.p_token_hash).toMatch(/^[a-f0-9]{64}$/);expect(sent.p_token_hash).not.toBe('b'.repeat(64));
    for(const [value,status] of [['forbidden',403],['rate_limited',429],['missing_run',409],['ineligible',422]] as const)
      expect((await handleAnalytics(req(),'feedback',env,async()=>Response.json(value))).status).toBe(status);
    const unavailable=await handleAnalytics(req(),'feedback',env,async()=>new Response('SECRET SQL ERROR',{status:500}));expect(unavailable.status).toBe(502);expect(await unavailable.text()).not.toContain('SECRET SQL ERROR');
  });
});
