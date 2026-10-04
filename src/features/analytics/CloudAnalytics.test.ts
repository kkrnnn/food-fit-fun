import { estimateExerciseEnergy } from '../../game/learning/ExerciseEnergy';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { RunRepository } from './RunRepository';
import { AnalyticsSync } from './AnalyticsSync';
import { cloudRun, validatePayload } from './cloudContract';
import { RunSession } from '../../game/learning/RunSession';
import { createQuestionSet, DEMO_BANK } from '../../game/learning/QuestionDeck';
import type { Profile } from '../../game/learning/types';

const profile: Profile = { playerId: 'local-player', nickname: 'PRIVATE NAME', version: 1, sex: 'male', ageMonths: 120,
  heightCm: 140, weightKg: 35, activity: 'active', avatar: 'mint' };
function run(outcome: 'game_over' | 'abandoned' = 'game_over') {
  const session = new RunSession(profile, createQuestionSet(DEMO_BANK,120,{contentVersion:DEMO_BANK.contentVersion,counts:{}},42,true), {
    runId: crypto.randomUUID(), startedAt: '2026-10-03T00:00:00Z', seed: 42, demo: true,
    contentVersion: DEMO_BANK.contentVersion, blueprintVersion: DEMO_BANK.blueprintVersion, mode: 'manual' });
  session.advance(1000); session.advance(6); session.endRun(outcome, 'test', '2026-10-03T00:03:00Z');
  return session.snapshot().record;
}
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('navigator', { onLine: true }); });

describe('local survey and atomic delivery queue', () => {
  it('persists a trimmed optional comment across reload and sends it once without overwriting the first submission', async () => {
    const repo=new RunRepository();let third=run();for(let i=0;i<3;i++){third=run();await repo.saveRun(third,1);}
    await repo.prepareSurvey(third.runId);
    await expect(repo.answerSurvey(third.runId,4,'x'.repeat(1001))).rejects.toThrow();
    expect((await repo.prepareSurvey(third.runId)).visible).toBe(true);
    await repo.answerSurvey(third.runId,4,'  อยากได้อาหารเพิ่ม 🍎\nกระโดดสนุกดี  ');
    const reloaded=new RunRepository();
    expect((await reloaded.prepareSurvey(third.runId)).state).toMatchObject({status:'submitted',rating:4,comment:'อยากได้อาหารเพิ่ม 🍎\nกระโดดสนุกดี'});
    await reloaded.answerSurvey(third.runId,1,'replacement');
    const received:unknown[]=[];
    const send=async(_url:RequestInfo|URL,init?:RequestInit)=>{
      if(init?.method)received.push(JSON.parse(String(init.body)));
      return Response.json(init?.method?{ok:true}:{enabled:true,runSchemaVersion:2,exerciseEnergyVersion:2});
    };
    const sync=new AnalyticsSync(reloaded,send);expect(await sync.flush()).toBe('synced');await sync.flush();
    expect(received.filter(p=>(p as {kind:string}).kind==='feedback')).toEqual([expect.objectContaining({rating:4,comment:'อยากได้อาหารเพิ่ม 🍎\nกระโดดสนุกดี'})]);
  });
  it('accepts legacy star-only feedback and empty comments but rejects malformed or oversized comments', () => {
    const payload={kind:'feedback',contextRunId:crypto.randomUUID(),surveyVersion:'enjoyment-v1',rating:3,eligibleRunCount:3,occurredAt:'2026-10-03T00:00:00Z'};
    expect(validatePayload(payload)).toEqual(payload);
    expect(validatePayload({...payload,comment:' \n\t '})).toEqual(payload);
    expect(validatePayload({...payload,comment:'ก'.repeat(1000)})).toMatchObject({comment:'ก'.repeat(1000)});
    for(const comment of [null,123,{},[], 'ก'.repeat(1001)])expect(()=>validatePayload({...payload,comment})).toThrow();
  });
  it('asks after every finished run, while skip and submit close only that run', async () => {
    const repo = new RunRepository();
    const first = run(); await repo.saveRun(first,1); await repo.saveRun(first,1);
    expect((await repo.prepareSurvey(first.runId)).visible).toBe(true);
    const abandoned=run('abandoned');await repo.saveRun(abandoned,1);
    expect((await repo.prepareSurvey(abandoned.runId)).visible).toBe(false);
    expect((await repo.analyticsData()).outbox.filter(e => e.payload.kind === 'event')).toHaveLength(0);
    await repo.answerSurvey(first.runId,null);await repo.answerSurvey(first.runId,5);
    expect((await new RunRepository().prepareSurvey(first.runId)).state.status).toBe('skipped');
    const second = run();await repo.saveRun(second,1);expect((await repo.prepareSurvey(second.runId)).visible).toBe(true);
    await repo.answerSurvey(second.runId,5,'  รอบสอง  ');await repo.answerSurvey(second.runId,1,'replacement');
    const saved = await new RunRepository().prepareSurvey(second.runId);
    expect(saved.visible).toBe(false);expect(saved.state).toMatchObject({status:'submitted',rating:5,comment:'รอบสอง'});
    const third=run();await repo.saveRun(third,1);expect((await repo.prepareSurvey(third.runId)).visible).toBe(true);
    await repo.answerSurvey(third.runId,3);
    const feedback=(await repo.analyticsData()).outbox.filter(e=>e.payload.kind==='feedback');expect(feedback).toHaveLength(2);
    expect(feedback.map(e=>e.payload.kind==='feedback'?e.payload.contextRunId:'')).toEqual(expect.arrayContaining([second.runId,third.runId]));
    expect(feedback.find(e=>e.payload.kind==='feedback'&&e.payload.contextRunId===second.runId)?.payload).toMatchObject({rating:5,comment:'รอบสอง',eligibleRunCount:2});
    const sent:string[]=[];
    const send=async(_url:RequestInfo|URL,init?:RequestInit)=>{
      if(init?.method)sent.push(JSON.parse(String(init.body)).kind);
      return Response.json(init?.method?{ok:true}:{enabled:true,runSchemaVersion:2,exerciseEnergyVersion:2});
    };
    expect(await new AnalyticsSync(repo,send).flush()).toBe('synced');
    expect(sent.filter(kind=>kind==='feedback')).toHaveLength(2);
    expect((await repo.analyticsData()).outbox.every(e=>e.state==='synced')).toBe(true);
    expect((await repo.load()).runs.find(r=>r.runId===second.runId)?.score).toBe(second.score);
  });
  it('upgrades v1 data without automatically uploading historical runs or counting them', async () => {
    const old = await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('body-rush-learning-v1',1);
      req.onupgradeneeded=()=>{req.result.createObjectStore('profiles',{keyPath:'playerId'});req.result.createObjectStore('runs',{keyPath:'runId'});req.result.createObjectStore('decks',{keyPath:'id'});req.result.createObjectStore('settings');};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const oldRun=run();const tx=old.transaction('runs','readwrite');tx.objectStore('runs').put(oldRun);
    await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});old.close();
    const repo=new RunRepository();expect((await repo.load()).runs).toHaveLength(1);
    expect((await repo.analyticsData()).outbox).toEqual([]);expect((await repo.prepareSurvey(oldRun.runId)).visible).toBe(false);
    await repo.saveRun(oldRun,1);expect((await repo.analyticsData()).outbox).toEqual([]);
  });
  it('keeps v2 feedback queued and suppresses prompts on historical runs after upgrade', async () => {
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('body-rush-learning-v1',2);
      req.onupgradeneeded=()=>{req.result.createObjectStore('profiles',{keyPath:'playerId'});req.result.createObjectStore('runs',{keyPath:'runId'});req.result.createObjectStore('decks',{keyPath:'id'});req.result.createObjectStore('settings');
        for(const name of ['analyticsIdentities','surveys','outbox'])req.result.createObjectStore(name,{keyPath:name==='outbox'?'id':'playerId'});};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const oldRun=run(),tx=db.transaction(['runs','surveys','outbox'],'readwrite');
    tx.objectStore('runs').put(oldRun);
    tx.objectStore('surveys').put({playerId:profile.playerId,eligibleCount:3,nextAsk:3,submitted:true,shownRunId:oldRun.runId,rating:4});
    tx.objectStore('outbox').put({id:`feedback:${profile.playerId}`,playerId:profile.playerId,createdAt:1,attempts:0,nextAttemptAt:0,state:'pending',payload:{kind:'feedback',contextRunId:oldRun.runId,surveyVersion:'enjoyment-v1',rating:4,eligibleRunCount:3,occurredAt:oldRun.endedAt}});
    await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});db.close();
    const repo=new RunRepository();expect((await repo.prepareSurvey(oldRun.runId)).state.status).toBe('historical');
    expect((await repo.analyticsData()).outbox).toHaveLength(1);
    const next=run();await repo.saveRun(next,1);expect((await repo.prepareSurvey(next.runId)).visible).toBe(true);
  });
  it('rejects invalid ratings and clears only the chosen player analytics', async () => {
    const repo=new RunRepository();await repo.saveRun(run(),1);const other={...run(),playerId:'other'};await repo.saveRun(other,1);
    await expect(repo.answerSurvey(other.runId,0)).rejects.toThrow();
    await repo.clear(profile.playerId);const data=await repo.analyticsData();expect(data.identities.map(i=>i.playerId)).toEqual(['other']);expect(data.outbox).toHaveLength(1);
  });
  it('sends energy snapshots with null BMI, excluding answers and measurements', () => {
    const record=run();record.initialBmi=18;record.simulatedBmi=17;
    const payload={kind:'run',run:cloudRun(record)};
    expect(validatePayload({...payload,secret:'ignored'})).toEqual(payload);
    expect(payload.run).toMatchObject({playerName:'PRIVATE NAME', sex:'male', ageYears:10, bmiStart:null, bmiEnd:null, testScore:record.correctCount, gameScore:record.score});
    const text=JSON.stringify(payload);for(const field of ['local-player','weightKg','heightCm','plannedQuestions','answers','explanation'])expect(text).not.toContain(field);
    expect(()=>validatePayload({kind:'run',run:{...payload.run,gameScore:NaN}})).toThrow();
    expect(()=>validatePayload({kind:'run',run:{...payload.run,testScore:11}})).toThrow();
    expect(()=>validatePayload({kind:'run',run:{...payload.run,bmiEnd:-1}})).toThrow();
    expect(()=>validatePayload({kind:'feedback',contextRunId:record.runId,surveyVersion:'enjoyment-v1',rating:6,eligibleRunCount:3,occurredAt:record.endedAt})).toThrow();
  });
  it('rejects changed food totals, portions, versions and missing kcal schema', () => {
    const record = run(), source = cloudRun(record);
    expect(validatePayload({kind:'run',run:source})).toMatchObject({run:{runSchemaVersion:2,foodIntakeKcal:record.foodIntakeKcal}});
    for (const patch of [
      {foodIntakeKcal:-1}, {foodIntakeKcal:source.foodIntakeKcal!+1}, {dailyEnergyKcal:Infinity},
      {dailyEnergyKcal:0}, {energyStatus:'unavailable'}, {nutritionVersion:'invented'},
      {runSchemaVersion:undefined}, {collectedFoods:[{foodId:'SHOES',name:'fake',portionLabel:'fake',count:1,kcalPerPortion:20}]},
    ]) expect(() => validatePayload({kind:'run',run:{...source,...patch}})).toThrow();
  });
  it('validates exercise deductions, negative net energy and pre-exercise snapshots', () => {
    const source=cloudRun(run());
    const record={...source,foodIntakeKcal:0,collectedFoods:[],exerciseKcal:6.297354861111111,netEnergyKcal:-6.297354861111111,
      collectedExercises:[{itemType:'ROPE',count:1,...estimateExerciseEnergy(profile).exerciseEstimates.ROPE}]};
    expect(validatePayload({kind:'run',run:record})).toMatchObject({run:{exerciseKcal:6.297354861111111,netEnergyKcal:-6.297354861111111}});
    for(const patch of [{exerciseKcal:31},{netEnergyKcal:0},{exerciseModelVersion:'fake'},
      {collectedExercises:[{itemType:'APPLE',count:1,kcalPerPickup:30}]},
      {collectedExercises:[{itemType:'ROPE',count:1.5,kcalPerPickup:30}]},
      {collectedExercises:[{itemType:'ROPE',count:11,kcalPerPickup:30}]},
      {collectedExercises:[{itemType:'ROPE',count:1,kcalPerPickup:300}]}])
      expect(()=>validatePayload({kind:'run',run:{...record,...patch}})).toThrow();
    const previous={...source};delete previous.exerciseModelVersion;delete previous.exerciseKcal;delete previous.netEnergyKcal;delete previous.collectedExercises;delete previous.exerciseEnergyStatus;delete previous.exerciseEnergyReason;
    expect(validatePayload({kind:'run',run:previous})).toMatchObject({run:{foodIntakeKcal:source.foodIntakeKcal}});
    expect(()=>validatePayload({kind:'run',run:{...previous,exerciseKcal:30}})).toThrow();
  });
  it('reloads old BMI and new kcal runs without backfilling or overwriting terminal snapshots', async () => {
    const repo = new RunRepository(), fresh = run();
    const old = {...run(), schemaVersion:1 as const, initialBmi:18, simulatedBmi:19};
    delete old.foodIntakeKcal; delete old.collectedFoods; delete old.dailyEnergyKcal;
    await repo.saveRun(old,1); await repo.saveRun(fresh,1);
    await repo.saveRun({...fresh,foodIntakeKcal:999,collectedFoods:[]},1);
    const reloaded = (await new RunRepository().load()).runs;
    expect(reloaded.find(r=>r.runId===old.runId)).toMatchObject({schemaVersion:1,initialBmi:18});
    expect(reloaded.find(r=>r.runId===old.runId)).not.toHaveProperty('foodIntakeKcal');
    expect(reloaded.find(r=>r.runId===fresh.runId)).toEqual(fresh);
    expect(cloudRun(old)).toMatchObject({bmiStart:18,bmiEnd:19});
    expect(cloudRun(old)).not.toHaveProperty('foodIntakeKcal');
  });
});

describe('delivery through the public synchronization boundary', () => {
  it('keeps kcal and its dependent feedback queued against an older API', async () => {
    const repo=new RunRepository(), record=run(); await repo.saveRun(record,1); await repo.answerSurvey(record.runId,4);
    const send=vi.fn(async()=>Response.json({enabled:true}));
    expect(await new AnalyticsSync(repo,send).flush()).toBe('pending');
    expect(send).toHaveBeenCalledTimes(1);
    expect((await repo.analyticsData()).outbox.every(e=>e.state==='pending')).toBe(true);
  });
  it('holds exercise deductions and dependent feedback against the first kcal API', async () => {
    const repo=new RunRepository(),record=run();await repo.saveRun(record,1);await repo.answerSurvey(record.runId,4);
    const send=vi.fn(async()=>Response.json({enabled:true,runSchemaVersion:2}));
    expect(await new AnalyticsSync(repo,send).flush()).toBe('pending');expect(send).toHaveBeenCalledTimes(1);
    expect((await repo.analyticsData()).outbox.every(e=>e.state==='pending')).toBe(true);
  });
  it('uses the browser fetch function without binding it to the synchronization instance', async () => {
    const repo = new RunRepository(); await repo.saveRun(run(), 1);
    const hostFetch = vi.fn(async function(this: unknown, _url: RequestInfo | URL, init?: RequestInit) {
      if (this instanceof AnalyticsSync) throw new TypeError('Illegal invocation');
      return Response.json(init?.method ? { ok: true } : { enabled: true, runSchemaVersion: 2, exerciseEnergyVersion: 2 });
    });
    vi.stubGlobal('fetch', hostFetch);
    expect(await new AnalyticsSync(repo).flush()).toBe('synced');
    expect((await repo.analyticsData()).outbox.every(e => e.state === 'synced')).toBe(true);
  });
  it('keeps offline/config-missing results pending, then sends scores before rating once and survives response loss', async () => {
    const repo=new RunRepository();let third=run();for(let i=0;i<3;i++){third=run();await repo.saveRun(third,1);}
    await repo.prepareSurvey(third.runId);await repo.answerSurvey(third.runId,4);
    const accepted=new Set<string>(), calls:string[]=[];let lose=true;
    const send=vi.fn(async (_url: RequestInfo | URL, init?:RequestInit)=>{
      if(!init?.method)return Response.json({enabled:true,runSchemaVersion:2,exerciseEnergyVersion:2});
      const p=JSON.parse(String(init.body));const id=p.kind==='run'?p.run.runId:p.kind==='event'?p.eventId:'feedback';calls.push(p.kind);accepted.add(id);
      if(lose){lose=false;throw new Error('lost acknowledgement');}return Response.json({ok:true});
    });
    vi.stubGlobal('navigator',{onLine:false});expect(await new AnalyticsSync(repo,send).flush()).toBe('offline');expect(send).not.toHaveBeenCalled();
    vi.stubGlobal('navigator',{onLine:true});expect(await new AnalyticsSync(repo,async()=>Response.json({enabled:false},{status:503})).flush()).toBe('unconfigured');
    expect(await new AnalyticsSync(repo,async()=>new Response('<html>SPA fallback</html>',{headers:{'content-type':'text/html'}})).flush()).toBe('unconfigured');
    let clock=Date.now();const sync=new AnalyticsSync(repo,send,()=>clock,()=>.5);
    expect(await sync.flush()).toBe('error');expect((await repo.analyticsData()).outbox.filter(e=>e.state==='synced')).toHaveLength(0);
    clock+=10_000;
    expect(await sync.flush()).toBe('synced');expect(accepted.size).toBe(4);expect(calls.slice(-1)).toEqual(['feedback']);
    const postCount=send.mock.calls.filter(([,init])=>init?.method).length;
    expect(await new AnalyticsSync(new RunRepository(),send).flush()).toBe('synced');
    expect(send.mock.calls.filter(([,init])=>init?.method)).toHaveLength(postCount);
  });
  it('retires previously queued events without sending them to cloud', async () => {
    const repo=new RunRepository(); const record=run(); await repo.saveRun(record,1);
    const db=await new Promise<IDBDatabase>(resolve=>{const req=indexedDB.open('body-rush-learning-v1',3);req.onsuccess=()=>resolve(req.result);});
    const tx=db.transaction('outbox','readwrite');
    tx.objectStore('outbox').put({id:'old-event',playerId:profile.playerId,createdAt:1,attempts:0,nextAttemptAt:0,state:'pending',payload:{kind:'event',eventId:crypto.randomUUID(),contextRunId:record.runId,surveyVersion:'enjoyment-v1',event:'shown',occurredAt:record.endedAt}});
    await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});db.close();
    const kinds:string[]=[]; const send=async(_url:RequestInfo|URL,init?:RequestInit)=>{if(!init?.method)return Response.json({enabled:true,runSchemaVersion:2,exerciseEnergyVersion:2});kinds.push(JSON.parse(String(init.body)).kind);return Response.json({ok:true});};
    expect(await new AnalyticsSync(repo,send).flush()).toBe('synced');expect(kinds).toEqual(['run']);
  });
  it('accepts pending v1 scores without fabricating name or BMI', () => {
    const legacy={kind:'run',run:{runId:crypto.randomUUID(),startedAt:'2026-10-03T00:00:00Z',endedAt:'2026-10-03T00:03:00Z',outcome:'game_over',score:100,correctCount:2,ageYearsAtStart:10,demo:true,contentVersion:'legacy',answers:[{private:'not sent'}]}};
    expect(validatePayload(legacy)).toMatchObject({kind:'run',run:{gameScore:100,testScore:2,playerName:null,sex:null,bmiStart:null,bmiEnd:null}});
  });
  it('stops automatic retries for permanent validation failures and offers explicit retry', async () => {
    const repo=new RunRepository();await repo.saveRun(run(),1);
    const send=vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>init?.method?Response.json({error:'invalid'},{status:400}):Response.json({enabled:true,runSchemaVersion:2,exerciseEnergyVersion:2}));
    const sync=new AnalyticsSync(repo,send);expect(await sync.flush()).toBe('error');await sync.flush();
    expect(send.mock.calls.filter(([,init])=>init?.method)).toHaveLength(1);
    await repo.retryAnalytics();await sync.flush();expect(send.mock.calls.filter(([,init])=>init?.method)).toHaveLength(2);
  });
  it('does not send captured pending rows after local data was cleared', async () => {
    const repo=new RunRepository();await repo.saveRun(run(),1);
    const send=vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{if(!init?.method){await repo.clear();return Response.json({enabled:true,runSchemaVersion:2,exerciseEnergyVersion:2});}return Response.json({ok:true});});
    expect(await new AnalyticsSync(repo,send).flush()).toBe('synced');
    expect(send.mock.calls.filter(([,init])=>init?.method)).toHaveLength(0);
  });
});
