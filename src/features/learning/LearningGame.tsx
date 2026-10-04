import React, { useEffect, useRef, useState } from 'react';
import { GameEngine3D, type GraphicsQuality } from '../../game/three/GameEngine3D';
import { CameraSession } from '../../game/camera/CameraSession';
import { PoseMapper, type PoseOutput } from '../../game/camera/PoseMapper';
import { RunSession, LEVEL_DISTANCE, COURSE_SPEED } from '../../game/learning/RunSession';
import { createQuestionSet, DEMO_BANK } from '../../game/learning/QuestionDeck';
import type { InputMode, Lane, Profile, Snapshot } from '../../game/learning/types';
import { RunRepository, type StoredData } from '../analytics/RunRepository';
import { ProfileForm, newProfile } from '../profile/ProfileForm';
import './LearningGame.css';
import { Practice } from './Practice';
import { GuidedTutorial } from '../../game/learning/GuidedTutorial';
import { TutorialMemory } from './TutorialMemory';
import { HandHoldStart } from '../../game/camera/HandHoldStart';
import { CameraRecovery } from '../../game/camera/CameraRecovery';
import { LearningAudio, readAudioPreferences } from '../../game/audio/LearningAudio';
import { JumpGesture } from '../../game/camera/JumpGesture';
import { ITEM_CATALOG } from '../../game/learning/ItemCatalog';
import { manualLane } from '../../game/learning/ManualLane';
import { swipeLane, swipeJump } from '../../game/learning/SwipeLane';
import { EnergyHud, EnergyResult } from './EnergyDisplay';
import { formatKcal } from '../health/energy';
import { formatGameKcal } from '../../game/learning/ExerciseEnergy';
import { pickupLabel } from '../../game/learning/PickupLabel';
import { FeedbackPanel } from '../analytics/FeedbackPanel';
import { AnalyticsSync } from '../analytics/AnalyticsSync';

type Screen = 'intro' | 'profile' | 'ready' | 'tutorial' | 'armed' | 'warmup' | 'run' | 'result';
const emptyData: StoredData = { profiles: [], runs: [], bank: null };
const laneNames = ['ซ้าย', 'กลาง', 'ขวา'];
function savedInputMode(): InputMode { try { return localStorage.getItem('food-fit-fun:input-mode') === 'manual' ? 'manual' : 'camera'; } catch { return 'camera'; } }
const OBJECTIVE_COPY = ['1.2.1 เพื่อพัฒนาโปรแกรม Food Fit Fun (ต้นแบบ) สำหรับเด็กน้ำหนักเกินชั้นประถมศึกษาปีที่ 4–6', '1.2.2 เพื่อศึกษาประสิทธิผลโปรแกรมโปรแกรม Food Fit Fun (ต้นแบบ) ดูแลเด็กที่มีภาวะน้ำหนักเกินต่อความรู้และพฤติกรรมสุขภาพของเด็กชั้นประถมศึกษาปีที่ 4–6'];

export function LearningGame() {
  const modalRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<GameEngine3D | null>(null);
  const sessionRef = useRef<RunSession | null>(null);
  const repository = useRef(new RunRepository());
  const analyticsSync = useRef(new AnalyticsSync(repository.current));
  const cameraRef = useRef<CameraSession | null>(null);
  const mapper = useRef(new PoseMapper());
  const generation = useRef(0);
  const modeRef = useRef<InputMode>(savedInputMode());
  const swipeStart = useRef<{ id: number; x: number; y: number; time: number } | null>(null);
  const cameraValid = useRef(false);
  const cameraCalibrated = useRef(false);
  const lastPose = useRef(-Infinity);
  const countdownRef = useRef(0);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const persistedKey = useRef('');
  const terminalSeen = useRef('');
  const avatarRef = useRef<Profile['avatar']>('mint');
  const selectLaneRef = useRef<(lane: Lane) => void>(() => {});
  const tickRef = useRef<(dt: number) => void>(() => {});
  const poseRef = useRef<(p: PoseOutput) => void>(() => {});
  const [screen, setScreen] = useState<Screen>('intro');
  const [data, setData] = useState<StoredData>(emptyData);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftProfile, setDraftProfile] = useState<Profile>(newProfile);
  const [mode, setMode] = useState<InputMode>(()=>modeRef.current);
  const [quality, setQuality] = useState<GraphicsQuality>(() => {
    try { const value = localStorage.getItem('body-rush-graphics-quality'); return value === 'low' || value === 'high' ? value : 'medium'; } catch { return 'medium'; }
  });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pickups, setPickups] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    if (!pickups.length) return;
    const timer = setTimeout(() => setPickups([]), 1400);
    return () => clearTimeout(timer);
  }, [pickups]);
  useEffect(() => setPickups([]), [snapshot?.record.runId, screen]);
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionOnly, setSessionOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('กล้องยังไม่เปิด');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [detectedLane, setDetectedLane] = useState<Lane>(1);
  const [pauseReason, setPauseReason] = useState('พักเกม');
  const [countdown, setCountdown] = useState(0);
  const [sceneError, setSceneError] = useState('');
  const [deletePlayer, setDeletePlayer] = useState(false);
  const demo = true; // The fixed research bank retains its provisional key provenance.
  const [introOpen, setIntroOpen] = useState(true);
  const [introChecked, setIntroChecked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioPreferences, setAudioPreferences] = useState(readAudioPreferences);
  const audio = useRef<LearningAudio | null>(null);
  if (!audio.current) audio.current = new LearningAudio(audioPreferences);
  const tutorialMemory = useRef<TutorialMemory | null>(null);
  if (!tutorialMemory.current) { let storage: Storage | null = null; try { storage = localStorage; } catch {} tutorialMemory.current = new TutorialMemory(storage); }
  const warmup = useRef<GuidedTutorial | null>(null);
  const [lesson, setLesson] = useState<ReturnType<GuidedTutorial['view']> | null>(null);
  const forceTutorial = useRef(false);
  const activeProfile = useRef<Profile | null>(null);
  const jumpDetector = useRef(new JumpGesture());
  const jumpRef = useRef<() => void>(() => {});
  const hold = useRef(new HandHoldStart());
  const [holdProgress, setHoldProgress] = useState(0);
  const startRef = useRef<() => void>(() => {});
  const startPending = useRef(false);
  const terminalDelay = useRef(0);
  const recovery = useRef(new CameraRecovery());
  const tutorialCheckpoint = useRef('');
  const countdownSound = useRef(0);
  const canHoldRef = useRef(false);
  const canHold = screen === 'armed' && !settingsOpen && !introOpen && !busy;


  useEffect(() => {
    const modal = modalRef.current;
    const content = contentRef.current;
    if (content) content.inert = introOpen || settingsOpen;
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(modal.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href]'));
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && settingsOpen) { event.preventDefault(); setSettingsOpen(false); }
      if (event.key !== 'Tab') return;
      const elements = controls(); const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    modal.addEventListener('keydown', trap);
    return () => { modal.removeEventListener('keydown', trap); previous?.focus(); if (content) content.inert = false; };
  }, [introOpen, settingsOpen]);

  canHoldRef.current = canHold;

  const refresh = async () => { const next = await repository.current.load(); setData(next); return next; };
  const syncAnalytics = async () => {
    try { await analyticsSync.current.flush(); }
    catch { /* Keep delivery queued for the periodic retry without adding result-screen status. */ }
  };
  useEffect(() => {
    void syncAnalytics();
    const timer = window.setInterval(() => { if (!document.hidden) void syncAnalytics(); }, 15_000);
    const online = () => { void syncAnalytics(); };
    window.addEventListener('online', online);
    return () => { window.clearInterval(timer); window.removeEventListener('online', online); };
  }, []);
  const stopCamera = () => {
    generation.current++; cameraRef.current?.stop(); cameraRef.current = null;
    cameraValid.current = false; cameraCalibrated.current = false; mapper.current.reset();
    setCameraReady(false); setCameraOn(false); setCameraStatus('กล้องยังไม่เปิด');
  };
  const saveProgress = (s: Snapshot) => {
    if (sessionOnly) return;
    const displayed = Math.max(s.record.answers.length, s.phase === 'quiz_approach' ? s.questionIndex + 1 : 0);
    writeQueue.current = writeQueue.current.catch(() => {}).then(() => repository.current.saveRun(s.record, displayed)).then(() => {
      if (s.record.outcome !== 'in_progress') void syncAnalytics();
    }).catch(() => {
      setStorageError(true); setNotice('เล่นได้ แต่บันทึกผลไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง');
    });
  };
  const pause = (reason: string, tracking = false) => {
    const session = sessionRef.current; if (!session || session.snapshot().phase === 'terminal') return;
    if (tracking && modeRef.current === 'camera') {
      jumpDetector.current.reset();
      if (!recovery.current.request(session,mapper.current,hold.current)) return;
      countdownRef.current=0;setCountdown(0);countdownSound.current=0;
      cameraValid.current=false;cameraCalibrated.current=false;setCameraReady(false);setHoldProgress(0);
      warmup.current?.setControlValid(false);
      setPauseReason(reason);setCameraStatus('ยืนนิ่งตรงกลาง ให้เห็นไหล่ถึงเอว 1.5 วินาที');
      setScreen('armed');audio.current?.quiet();
      return;
    }
    countdownRef.current = 0; setCountdown(0);
    audio.current?.quiet();
    session.pause(tracking); setPauseReason(reason);
  };
  const selectLane = (lane: Lane) => {
    if (modeRef.current !== 'manual' || settingsOpen || introOpen || document.hidden) return;
    if (warmup.current) { if (!countdownRef.current) warmup.current.setLane(lane); return; }
    const s = sessionRef.current?.snapshot();
    if (!s || s.paused || countdownRef.current > 0 || !['running','quiz_approach','quiz_feedback'].includes(s.phase)) return;
    sessionRef.current?.setLane(lane);
  };
  selectLaneRef.current = selectLane;
  const chooseMode = (next: InputMode) => {
    if (next === 'manual') stopCamera();
    hold.current.reset(); setHoldProgress(0);
    modeRef.current = next; setMode(next);
    try { localStorage.setItem('food-fit-fun:input-mode',next); } catch {} sessionRef.current?.setInputMode(next);
    if (next === 'camera') sessionRef.current?.invalidateControl();
  };
  jumpRef.current = () => {
    if (!['run','warmup'].includes(screen) || countdownRef.current || settingsOpen || document.hidden) return;
    const accepted=warmup.current ? warmup.current.jump() : sessionRef.current?.jump();
    if(accepted) audio.current?.cue('confirm');
  };
  const beginCamera = () => {
    void audio.current?.unlock();
    if (!videoRef.current) return;
    jumpDetector.current.reset();
    stopCamera(); chooseMode('camera');
    const id = ++generation.current; setCameraOn(true);
    const camera = new CameraSession({
      onPhase: (phase, message) => {
        if (id !== generation.current) return;
        setCameraStatus(message || (phase === 'active' ? 'ยืนนิ่งตรงกลาง ให้เห็นไหล่ถึงเอว 1.5 วินาที' : 'กล้องยังไม่พร้อม'));
        if (phase === 'error') { cameraValid.current = false; setCameraReady(false); pause(message || 'กล้องหยุดทำงาน', true); }
      },
      onPose: (landmarks, time) => {
        if (id !== generation.current || document.hidden) return;
        lastPose.current = performance.now();
        const output = mapper.current.ingest(landmarks, time, performance.now());
        poseRef.current(output);
        if(jumpDetector.current.ingest(landmarks,performance.now(), output.calibrated && output.trackingValid && !output.trackingLost && !canHoldRef.current && !countdownRef.current)) jumpRef.current();
        const h = hold.current.ingest(landmarks, performance.now(), canHoldRef.current && output.calibrated && output.trackingValid && !output.trackingLost);
        setHoldProgress(h.progress);
        if (h.completed) { audio.current?.cue('hold'); startRef.current(); }
      },
      onInterrupted: message => { if (id === generation.current) pause(message, true); },
    });
    cameraRef.current = camera; void camera.start(videoRef.current);
  };
  poseRef.current = output => {
    const valid = output.calibrated && output.trackingValid && !output.trackingLost;
    cameraValid.current = valid; cameraCalibrated.current = output.calibrated;
    setCameraReady(valid);
    if (valid && output.lane !== undefined) {
      setDetectedLane(output.lane); warmup.current?.setLane(output.lane, true); sessionRef.current?.setLane(output.lane, true);
      setCameraStatus(`พร้อม · เลน${laneNames[output.lane]}`);
    } else {
      warmup.current?.setLane(detectedLane, false); sessionRef.current?.invalidateControl();
      if (output.setupHint === 'show-upper-body') setCameraStatus('ให้เห็นไหล่ถึงเอว และกลับมาตรงกลาง');
      else if (!output.calibrated) setCameraStatus('ยืนนิ่งตรงกลาง 1.5 วินาที เพื่อตั้งท่ากลาง');
    }
    // Hold-start is isolated from gameplay and legacy jump pulses.
    if (output.trackingLost) pause('จับท่าหลุด เกมพักไว้แล้ว กลับมาในกรอบหรือใช้ปุ่มแทน', true);
  };

  useEffect(() => {
    let active = true;
    let interruptedId: string | null = null;
    try { interruptedId = sessionStorage.getItem('body-rush-tab-run'); sessionStorage.removeItem('body-rush-tab-run'); } catch {}
    void (interruptedId ? repository.current.recoverInterrupted(interruptedId) : Promise.resolve()).then(() => repository.current.load()).then(next => {
      if (!active) return; setData(next);
      let id: string | null = null; try { id = localStorage.getItem('body-rush-active-player'); } catch {}
      const selected = next.profiles.find(p => p.playerId === id) ?? next.profiles[0] ?? null;
      setProfile(selected); if (selected) avatarRef.current = selected.avatar;
    }).catch(() => { if (active) { setSessionOnly(true); setNotice('อุปกรณ์นี้ยังบันทึกไม่ได้ เล่นได้เฉพาะรอบนี้'); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let frame = 0, last = performance.now();
    try { if (sceneRef.current) { engineRef.current = new GameEngine3D(sceneRef.current); engineRef.current.setGraphicsQuality(quality); } }
    catch { setSceneError('เปิดฉาก 3D ไม่สำเร็จ กรุณาเปิด WebGL หรือใช้เบราว์เซอร์ที่รองรับ'); }
    const loop = (now: number) => {
      const dt = Math.min(.5, Math.max(0, (now - last) / 1000)); last = now;
      tickRef.current(dt); frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const onVisibility = () => {
      if (document.hidden) { audio.current?.quiet(); hold.current.reset();setHoldProgress(0);pause('แท็บถูกซ่อน กดเล่นต่อเมื่อพร้อม'); cameraRef.current?.pauseFrames(); }
      else cameraRef.current?.resumeFrames();
    };
    const onKey = (event: KeyboardEvent) => {
      if (['INPUT','SELECT','TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) return;
      if (event.key === 'Escape') pause('พักเกม');
      const s = warmup.current && sessionRef.current ? warmup.current.view(sessionRef.current.snapshot()).snapshot : sessionRef.current?.snapshot();
      if (!s || modeRef.current !== 'manual' || (!warmup.current && s.paused) || countdownRef.current) return;
      if((event.code==='Space' || event.key==='ArrowUp') && !event.repeat){event.preventDefault();jumpRef.current();return;}
      const lane = manualLane(event.key, event.code, s.lane);
      if (lane !== null) { event.preventDefault(); selectLaneRef.current(lane); }
    };
    document.addEventListener('visibilitychange', onVisibility); window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); generation.current++; cameraRef.current?.stop(); engineRef.current?.destroy(); engineRef.current = null;
      audio.current?.destroy();
      document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('keydown', onKey); };
  }, []);

  const dispatchTime = useRef(0);
  tickRef.current = dt => {
    const session = sessionRef.current;
    if (!canHold || document.hidden) { hold.current.reset(); if (holdProgress) setHoldProgress(0); }
    else { const h = hold.current.tick(performance.now()); if (h.progress !== holdProgress) setHoldProgress(h.progress); }
    if (modeRef.current === 'camera' && cameraRef.current?.isActive) {
      const now = performance.now();
      if (now - lastPose.current > 250) { cameraValid.current = false; setCameraReady(false); session?.invalidateControl(); warmup.current?.setLane(detectedLane,false); }
      const tick = mapper.current.tick(now);
      if (tick.trackingLost && session && !recovery.current.active && (!session.snapshot().paused || warmup.current || countdownRef.current>0)) pause('ไม่พบตัวผู้เล่น เกมพักไว้แล้ว', true);
    }
    if (session && warmup.current) {
      const valid = modeRef.current === 'manual' || cameraValid.current;
      if (countdownRef.current > 0 && valid && !document.hidden && !settingsOpen) {
        const count=Math.ceil(countdownRef.current);if(count!==countdownSound.current)audio.current?.cue('countdown');countdownSound.current=count;
        countdownRef.current = Math.max(0,countdownRef.current-dt);setCountdown(Math.ceil(countdownRef.current));
      }
      if (modeRef.current === 'manual') warmup.current.setControlValid(true);
      warmup.current.advance(dt, screen === 'warmup' && !countdownRef.current && !document.hidden && !settingsOpen && valid);
      const view = warmup.current.view(session.snapshot());
      if (!countdownRef.current) countdownSound.current=0;
      const checkpoint = `${view.stage}:${view.success}`;
      const lessonChanged=checkpoint!==tutorialCheckpoint.current;
      if (lessonChanged) {
        if (view.success) { audio.current?.cue('correct'); engineRef.current?.learningEffect(true,audioPreferences.reducedMotion); }
        tutorialCheckpoint.current = checkpoint;
      }
      audio.current?.ambient(screen==='warmup' && !view.waiting && valid && !document.hidden && !countdownRef.current);
      dispatchTime.current+=dt;
      if(dispatchTime.current>=.08 || lessonChanged || view.completed) { dispatchTime.current=0;setLesson(view);setSnapshot(view.snapshot); }
      engineRef.current?.renderLearning(view.snapshot,view.items,dt,avatarRef.current);
      if (view.completed) finishTutorial('completed');
      return;
    }
    if (session) {
      if (countdownRef.current > 0 && !document.hidden) {
        if (modeRef.current === 'camera' && !cameraValid.current) {
          pause('กล้องยังไม่พร้อม กลับมาตั้งท่าและยกมือค้างเพื่อเล่นต่อ', true);
        }
        else { countdownRef.current = Math.max(0, countdownRef.current - dt); setCountdown(Math.ceil(countdownRef.current)); if (!countdownRef.current) session.resume(); }
      }
      if (!document.hidden && !settingsOpen) session.advance(dt);
      const s = session.snapshot();
      audio.current?.ambient(!s.paused && s.phase !== 'terminal' && !document.hidden && !countdownRef.current);
      const count = Math.ceil(countdownRef.current);
      if (count && count !== countdownSound.current) audio.current?.cue('countdown');
      countdownSound.current = count;
      const events = session.drainEvents();
      const itemEvents = events.filter(event => event.kind === 'item');
      if (itemEvents.length) setPickups(current => [...current, ...itemEvents.map(event => ({ id: event.id, label: pickupLabel(event.type, event.deltaKcal) }))].slice(-3));
      for (const event of events) {
        if (event.kind !== 'answer') {
          const beneficial=event.kind==='item' && ITEM_CATALOG[event.type].category !== 'occasional';
          audio.current?.cue(beneficial ? 'pickup' : 'treat');
          engineRef.current?.learningPickup(event.type,audioPreferences.reducedMotion,event.deltaKcal);
        } else { audio.current?.cue(event.correct ? 'correct' : 'wrong'); engineRef.current?.learningEffect(event.correct,audioPreferences.reducedMotion); }
      }
      const key = `${s.record.runId}:${s.phase}:${s.questionIndex}:${s.record.answers.length}:${Math.floor(s.distance / 40)}:${s.record.outcome}`;
      if (key !== persistedKey.current) { persistedKey.current = key; saveProgress(s); }
      if (s.phase === 'terminal') {
        if (terminalSeen.current !== s.record.runId) {
          terminalSeen.current = s.record.runId; terminalDelay.current = 1;
          try { sessionStorage.removeItem('body-rush-tab-run'); } catch {}
          setSnapshot(s);
        } else if (!document.hidden) terminalDelay.current = Math.max(0,terminalDelay.current-dt);
        if (!terminalDelay.current && screen === 'run') {
          audio.current?.cue(s.record.outcome === 'completed' ? 'finish' : 'gameover');
          stopCamera();setScreen('result');setSnapshot(s);
          setData(current => ({ ...current, runs: [...current.runs.filter(r => r.runId !== s.record.runId), s.record] }));
        }
      }
      dispatchTime.current += dt;
      if (dispatchTime.current >= .08) { dispatchTime.current = 0; setSnapshot(s); }
      engineRef.current?.renderLearning(s, session.visibleItems(), dt, avatarRef.current);
    } else engineRef.current?.renderLearning(null, [], dt, avatarRef.current);
  };

  const start = async (nextProfile?: Profile) => {
    const selected = nextProfile ?? profile;
    if (startPending.current || busy || !selected || sceneError || (modeRef.current === 'camera' && !cameraValid.current)) return;
    if (recovery.current.active && sessionRef.current) {
      if (!recovery.current.accept(modeRef.current==='manual' || cameraValid.current)) return;
      sessionRef.current.setLane(modeRef.current==='camera' ? detectedLane : sessionRef.current.snapshot().lane,true);
      countdownRef.current=3;setCountdown(3);countdownSound.current=0;setScreen(warmup.current ? 'warmup' : 'run');return;
    }
    startPending.current = true; setBusy(true); setNotice(''); activeProfile.current = selected;
    try {
      await writeQueue.current;
      const bank = DEMO_BANK;
      const deck = sessionOnly ? { contentVersion: bank.contentVersion, counts: {} } : await repository.current.deck(selected.playerId, bank.contentVersion);
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const questions = createQuestionSet(bank, selected.ageMonths, deck, seed, demo);
      const session = new RunSession(selected, questions, { runId: crypto.randomUUID(), startedAt: new Date().toISOString(), seed, demo, contentVersion: bank.contentVersion, blueprintVersion: bank.blueprintVersion, mode: modeRef.current });
      const jumpOnly = !forceTutorial.current && tutorialMemory.current!.has(selected.playerId);
      const needsTutorial = forceTutorial.current || !tutorialMemory.current!.has(selected.playerId) || tutorialMemory.current!.needsUpgrade(selected.playerId);
      jumpDetector.current.reset();
      forceTutorial.current = false;
      if (!needsTutorial) { try { sessionStorage.setItem('body-rush-tab-run', session.snapshot().record.runId); } catch {} }
      session.pause(); sessionRef.current = session; avatarRef.current = selected.avatar; countdownRef.current = 3; setCountdown(3);
      persistedKey.current = ''; terminalSeen.current = '';countdownSound.current=0; setPauseReason('พร้อมออกวิ่ง'); setSnapshot(session.snapshot()); setScreen('run');
      if (needsTutorial) { warmup.current = new GuidedTutorial(jumpOnly); setLesson(warmup.current.view(session.snapshot()));setScreen('warmup');tutorialCheckpoint.current=''; }
      else saveProgress(session.snapshot());
    } catch (e) { setNotice(e instanceof Error ? e.message : 'เริ่มรอบไม่สำเร็จ'); }
    finally { setBusy(false); startPending.current = false; }
  };
  startRef.current = () => { if (!startPending.current) void start(activeProfile.current ?? undefined); };
  const finishTutorial = (status: 'completed' | 'skipped') => {
    const selected = activeProfile.current; let session = sessionRef.current;
    if (!selected || !session || !warmup.current) return;
    if (!tutorialMemory.current!.finish(selected.playerId,status)) setNotice('จำการฝึกได้ในรอบนี้ แต่บันทึกลงเครื่องไม่ได้');
    const original = session.snapshot().record;
    session = new RunSession(selected,original.plannedQuestions,{runId:original.runId,startedAt:new Date().toISOString(),seed:original.seed,demo:original.demo,contentVersion:original.contentVersion,blueprintVersion:original.blueprintVersion,mode:modeRef.current});
    sessionRef.current=session;session.pause();
    warmup.current = null;setLesson(null);session.setLane(modeRef.current === 'camera' ? detectedLane : 1,modeRef.current === 'manual' || cameraValid.current);
    session.pause();countdownRef.current=3;setCountdown(3);setScreen('run');
    try { sessionStorage.setItem('body-rush-tab-run',session.snapshot().record.runId); } catch {}
    setSnapshot(session.snapshot());saveProgress(session.snapshot());audio.current?.cue('confirm');
  };
  const requestPlay = (selected: Profile) => {
    recovery.current.cancel();activeProfile.current = selected;hold.current.reset();setHoldProgress(0);
    if (modeRef.current === 'camera') { setScreen('armed'); if (!cameraRef.current?.isActive) beginCamera(); }
    else void start(selected);
  };
  const leaveRun = () => {
    const session = sessionRef.current;
    if (session && !warmup.current && session.snapshot().phase !== 'terminal') {
      session.endRun('abandoned', 'player_exit'); const record = session.snapshot().record; saveProgress(session.snapshot());
      setData(current => ({ ...current, runs: [...current.runs.filter(r => r.runId !== record.runId), record] }));
    }
    try { sessionStorage.removeItem('body-rush-tab-run'); } catch {}
    recovery.current.cancel();warmup.current=null;setLesson(null);audio.current?.quiet();
    countdownRef.current = 0; setCountdown(0); stopCamera(); sessionRef.current = null; setSnapshot(null); setScreen('ready');
  };
  const backToReady = () => { recovery.current.cancel();audio.current?.quiet(); sessionRef.current = null; setSnapshot(null); setNotice(''); setScreen('ready'); };
  const resume = () => {
    if (document.hidden || (modeRef.current === 'camera' && !cameraValid.current)) return;
    countdownRef.current = 3; setCountdown(3);
  };
  const edit = (p?: Profile) => { setDraftProfile(p ?? profile ?? newProfile()); setScreen('profile'); };
  const setGraphics = (value: GraphicsQuality) => {
    setQuality(value); engineRef.current?.setGraphicsQuality(value);
    try { localStorage.setItem('body-rush-graphics-quality', value); } catch {}
  };
  const s = snapshot;
  const inRun = screen === 'run' || screen === 'warmup';
  const inPractice = screen === 'warmup';
  const result = screen === 'result' && s;
  const options = s?.question?.options ?? [];

  return <main onClickCapture={() => { void audio.current?.unlock(); }} onPointerDownCapture={() => { void audio.current?.unlock(); }} onKeyDownCapture={() => { void audio.current?.unlock(); }} className={`lr-game ${mode === 'camera' ? 'lr-camera-mode' : ''} ${audioPreferences.reducedMotion ? 'lr-reduced-motion' : ''} ${inRun && mode === 'manual' && (!s?.paused || inPractice) ? 'lr-touch-run' : ''}`}
    onPointerDown={event => {
      if (!event.isPrimary) { swipeStart.current = null; return; }
      if (!inRun || modeRef.current !== 'manual' || (event.pointerType === 'mouse' && event.button !== 0) ||
          (event.target as HTMLElement).closest('button,input,select,textarea,a,[role="dialog"]')) return;
      const current = warmup.current && sessionRef.current ? warmup.current.view(sessionRef.current.snapshot()).snapshot : sessionRef.current?.snapshot();
      if (!current || (!warmup.current && current.paused) || countdownRef.current || current.phase === 'terminal') return;
      swipeStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerUp={event => {
      const start = swipeStart.current;
      if (!start || start.id !== event.pointerId) return;
      swipeStart.current = null;
      const current = warmup.current && sessionRef.current ? warmup.current.view(sessionRef.current.snapshot()).snapshot : sessionRef.current?.snapshot();
      if (!current) return;
      const dx=event.clientX-start.x,dy=event.clientY-start.y,elapsed=event.timeStamp-start.time;
      if(swipeJump(dx,dy,elapsed)){jumpRef.current();return;}
      const lane = swipeLane(event.clientX-start.x,event.clientY-start.y,event.timeStamp-start.time,current.lane);
      if (lane !== null) selectLane(lane);
    }}
    onPointerCancel={() => { swipeStart.current = null; }}
    onLostPointerCapture={() => { swipeStart.current = null; }}>

    <div ref={sceneRef} className="lr-scene" aria-hidden="true" />
    <aside hidden={!cameraOn} className={`lr-camera ${inRun ? 'playing' : ''} ${settingsOpen ? 'in-settings' : ''}`}><video ref={videoRef} autoPlay playsInline muted /><div>{cameraStatus}</div><small>ตรวจเลน: {laneNames[detectedLane]} · ภาพไม่ถูกบันทึก</small></aside>
    <div ref={contentRef} className="lr-content">{inRun && s ? <>
      {mode === 'manual' && (!s.paused || inPractice) && <small className="lr-swipe-hint">ปัดซ้าย–ขวาเปลี่ยนเลน · ปัดขึ้นกระโดด</small>}
      {notice && <div className="lr-run-notice" role="status">{notice}</div>}
      <header className="lr-hud"><div className="lr-brand-small">FOOD <b>FIT FUN</b><small>{s.record.demo ? 'ชุดทดลอง' : 'ภารกิจเมืองสมดุล'}</small></div>
        <div className="lr-progress"><div><span>{inPractice ? 'ลองเล่น · ไม่บันทึกคะแนน' : <>เส้นชัย {Math.floor(s.distance / LEVEL_DISTANCE * 100)}% · เหลือ {Math.max(0, Math.ceil((LEVEL_DISTANCE - s.distance) / COURSE_SPEED))} วินาที</>}</span><strong>{inPractice ? 'ฝึกทีละขั้น' : <>คำถาม {Math.min(s.questionIndex + 1, 10)} / 10</>}</strong></div><progress value={inPractice ? lesson?.progress ?? 0 : s.distance} max={inPractice ? lesson?.total ?? 4 : LEVEL_DISTANCE} /></div>
        <div className={`lr-streak ${s.wrongStreak === 2 ? 'warning' : ''}`}><small>ผิดติดต่อกัน</small><strong>{s.wrongStreak} / 3</strong></div><button className="secondary" onClick={() => inPractice ? leaveRun() : pause('พักเกม')}>{inPractice ? 'กลับเมนู' : 'พัก'}</button></header>
      <EnergyHud snapshot={s} />
      {!!pickups.length && !s.paused && <div className="lr-kcal-pickups" role="status" aria-live="polite" aria-atomic="true">{pickups.map(p => <p key={p.id}>{p.label}</p>)}</div>}
      {inPractice && lesson && <section className="lr-guided-tip" role="status"><p className="lr-kicker">ลองเล่น · ขั้น {lesson.progress+1} / {lesson.total}</p><h2>{lesson.success ? '✓ ใช่แล้ว! ไปต่อกัน' : lesson.stage === 'lane' ? 'ขยับไปหาแสง' : lesson.stage === 'item' ? 'เลือกเลนที่ไฮไลต์' : lesson.stage === 'jump' ? 'กระโดดเบา ๆ เพื่อเก็บสัญลักษณ์' : `เลือกคำตอบ: ${s.question?.options.find(o => o.optionId === s.question?.question.correctOptionId)?.text ?? ''}`}</h2><p>{lesson.success ? 'ฉากกำลังเดินต่อ' : !cameraReady && mode === 'camera' ? cameraStatus : lesson.stage === 'jump' ? (mode === 'camera' ? 'อยู่เลนกลาง ให้เห็นไหล่ถึงเอว แล้วกระโดดเบา ๆ' : 'อยู่เลนกลาง กด Space / ↑ หรือปัดขึ้น') : mode === 'camera' ? 'ขยับไหล่เข้าเลนที่ไฮไลต์ แล้วอยู่นิ่งสักครู่' : 'กด ← / → หรือ A / D หรือปัดจอ ไปเลนที่ไฮไลต์'}</p>{mode==='camera' && !cameraReady && <button className="secondary" onClick={()=>chooseMode('manual')}>ใช้ปุ่ม / ปัดจอแทน</button>}{lesson.stage==='item' && <small>ลองเก็บสัญลักษณ์ในเลนที่ไฮไลต์</small>}{lesson.stage==='quiz' && <small>ลองประตูคำตอบ</small>}<small className="lr-guided-energy">พลังงานสุทธิในเกม {s.netEnergyKcal===null?'ยังประมาณครบไม่ได้':formatGameKcal(s.netEnergyKcal)} kcal</small><div className="lr-tutorial-lanes" aria-hidden="true">{[0,1,2].map(i=><span key={i} className={i===lesson.target ? 'target' : ''}>{i===lesson.target ? '✦' : '·'}</span>)}</div><button className="lr-link" onClick={() => finishTutorial('skipped')}>ข้ามการฝึก</button></section>}

      {s.phase === 'quiz_approach' && <>
        <section className={`lr-question-banner ${s.questionIndex === 9 ? 'finish-question' : ''}`} aria-live="polite"><p className="lr-kicker">{s.questionIndex === 9 ? 'FINISH · คำถามสุดท้าย' : `QUIZ ${s.questionIndex + 1} / 10`}</p><h2>{s.question?.question.prompt}</h2><progress value={s.approachProgress} max={1} /><div className="lr-gate-choices">{options.map((o, i) => <button key={o.optionId} className={s.lane === i ? 'selected' : ''} aria-pressed={s.lane === i} disabled={mode === 'camera' || (s.paused && !inPractice)} onClick={() => selectLane(i as Lane)}><strong>{o.text}</strong></button>)}</div><small>{s.waitingForLane ? 'รอเลนนิ่งก่อนตัดสิน' : s.questionIndex === 9 ? 'เลือกคำตอบ แล้ววิ่งผ่านเส้นชัย!' : 'วิ่งเข้าประตูคำตอบที่เลือก!'}</small></section>
      </>}
      {(s.phase === 'quiz_feedback' || s.phase === 'terminal') && s.lastAnswer && <div className={`lr-live-feedback ${s.lastAnswer?.isCorrect ? 'correct' : 'wrong'}`} role="status"><strong>{s.lastAnswer?.isCorrect ? '✓ ถูกต้อง!' : `↻ ผิดติดกัน ${s.wrongStreak}/3`}</strong><span>{!s.lastAnswer?.isCorrect && <>คำตอบ: {s.lastAnswer?.options.find(o => o.optionId === s.lastAnswer?.correctOptionId)?.text} · </>}{s.lastAnswer?.explanation}</span></div>}
      {((s.paused && !inPractice) || countdown > 0) && <div className="lr-pause-shade"><section className="lr-pause"><p className="lr-kicker">{countdown ? 'เตรียมตัว' : 'พักไว้ก่อน'}</p><h2>{countdown || pauseReason}</h2>
        {!countdown && <><p>ระยะทางและคำตอบหยุดไว้ กลับมาตั้งท่าแล้วกดเล่นต่อ</p><div className="lr-actions"><button disabled={mode === 'camera' && !cameraReady} onClick={resume}>เล่นต่อ</button><button className="secondary" onClick={() => { chooseMode('manual'); setPauseReason('พร้อมใช้ปุ่มแล้ว กดเล่นต่อ'); }}>ใช้ปุ่มแทนกล้อง</button><button className="secondary" onClick={beginCamera}>เปิด / ตั้งกล้องใหม่</button><button className="secondary" onClick={leaveRun}>ออกจากรอบ</button></div></>}
      </section></div>}
    </> : <div className={`lr-page ${['intro','ready'].includes(screen) ? 'title' : ''}`}><div className={`lr-sheet ${['intro','ready'].includes(screen) ? 'lr-title-stage' : ''}`}>
      {notice && <div className="lr-notice" role="status">{notice}{storageError && <button className="secondary" onClick={async () => {
        if (!sessionRef.current) return;
        await writeQueue.current;
        const pending = sessionRef.current.snapshot();
        try { await repository.current.saveRun(pending.record, Math.max(pending.record.answers.length, pending.phase === 'quiz_approach' ? pending.questionIndex + 1 : 0)); setStorageError(false); setNotice('บันทึกผลแล้ว'); }
        catch { setNotice('ยังบันทึกผลไม่สำเร็จ กรุณาลองอีกครั้ง'); }
      }}>ลองบันทึกผลอีกครั้ง</button>}</div>}
      {sceneError && <p className="lr-error" role="alert">{sceneError}</p>}
      {['intro','ready'].includes(screen) && <>
        <div className="lr-title-heading"><span className="lr-world-badge">✦ ภารกิจเมืองสมดุล ✦</span><h1 className="lr-title-logo">FOOD <span>FIT FUN</span></h1><p>ขยับให้สนุก · เลือกให้พอดี · เรียนรู้ไปด้วยกัน</p></div>
        <div className="lr-home-actions"><button className="lr-play-button" disabled={loading || !!sceneError} onClick={() => edit(profile ?? newProfile())}>{loading ? 'กำลังโหลด…' : '▶ PLAY'}</button><button className="lr-settings-button secondary" onClick={() => setSettingsOpen(true)}>⚙ SETTINGS</button><small>{profile ? `พร้อมเล่นอีกครั้ง ${profile.nickname}` : 'ประมาณ 3 นาที · 10 คำถาม · ผิดติดกัน 3 ข้อจบรอบ'}</small></div>
        <button className="lr-home-help" onClick={() => setScreen('tutorial')}>? วิธีเล่น</button>
      </>}
      {screen === 'profile' && <><div className="lr-profile-control"><span>{mode === 'camera' ? cameraStatus : '← / →, A / D หรือปัดจอ'}</span>{mode === 'camera' && !cameraReady && <button className="secondary" onClick={beginCamera}>เปิดกล้อง</button>}<button className="lr-link" onClick={() => chooseMode(mode === 'camera' ? 'manual' : 'camera')}>{mode === 'camera' ? 'ใช้ปุ่มแทน' : 'ใช้กล้อง'}</button></div><ProfileForm key={draftProfile.playerId} initial={draftProfile} onCancel={() => setScreen(profile ? 'ready' : 'intro')} onSave={async p => {
        if (p.playerId === 'demo-player') p = { ...p, playerId: crypto.randomUUID() };
        if (!sessionOnly) await repository.current.saveProfile(p);
        setProfile(p); avatarRef.current = p.avatar; setData(current => ({ ...current, profiles: [...current.profiles.filter(x => x.playerId !== p.playerId), p] }));
        try { localStorage.setItem('body-rush-active-player', p.playerId); } catch {}
        requestPlay(p);
      }} /></>}
      {screen === 'armed' && <section className="lr-gesture-start"><p className="lr-kicker">{recovery.current.active ? `เกมพักไว้ · ${profile?.nickname}` : `พร้อมออกวิ่ง · ${profile?.nickname}`}</p>{recovery.current.active && <p className="lr-recovery-note">{pauseReason} · {warmup.current ? 'ฝึกต่อจากขั้นเดิม' : `คำถาม ${Math.min((snapshot?.questionIndex ?? 0)+1,10)} / 10`}</p>}<h1>{cameraReady ? (recovery.current.active ? 'ยกมือค้างไว้เพื่อเล่นต่อ' : 'ยกมือค้างไว้เพื่อเริ่ม') : (recovery.current.active ? 'ตั้งท่ากลางใหม่ก่อนเล่นต่อ' : 'ตั้งท่ากลางก่อนเริ่ม')}</h1><div className="lr-hold-ring" role="progressbar" aria-label={recovery.current.active ? 'ยกมือค้างเพื่อเล่นต่อ' : 'ยกมือค้างเพื่อเริ่ม'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(holdProgress*100)} style={{ '--hold': `${holdProgress*360}deg` } as React.CSSProperties}><span>✋</span></div><p className="lr-gesture-instruction">{holdProgress > 0 ? 'ค้างไว้อีกนิด…' : cameraReady ? 'ลดมือลงก่อน แล้วยกมือข้างใดข้างหนึ่งเหนือไหล่ค้าง 1.5 วินาที' : cameraStatus}</p><div className="lr-actions"><button className="secondary" onClick={beginCamera}>ตั้งกล้องใหม่</button><button disabled={!cameraReady || busy} onClick={() => void start(activeProfile.current ?? undefined)}>{recovery.current.active ? 'เล่นต่อด้วยปุ่ม' : 'เริ่มด้วยปุ่ม'}</button><button className="secondary" onClick={() => { chooseMode('manual'); void start(activeProfile.current ?? undefined); }}>ใช้ปุ่ม / ปัดจอ</button><button className="lr-link" onClick={() => { hold.current.reset();leaveRun(); }}>กลับ</button></div></section>}
      {screen === 'tutorial' && <>
        <p className="lr-kicker">ก่อนออกวิ่ง</p><h1>เลือกให้พอดี ตอบให้เข้าใจ</h1><ol className="lr-tutorial"><li><strong>เลือกเลน</strong><p>กล้อง: เลื่อนไหล่ซ้าย–ขวาจากท่ากลาง · ปุ่ม: ← / → หรือ A / D เลื่อนทีละเลน · มือถือปัดซ้าย–ขวา กระโดดเก็บสัญลักษณ์ออกกำลังกาย: กล้องกระโดดเบา ๆ · ปุ่ม Space / ↑ · มือถือปัดขึ้น · กระโดดข้ามอาหารบนพื้นโดยไม่เก็บ</p></li><li><strong>เลือกของให้สมดุล</strong><p>อาหารทุกชนิดเพิ่ม kcal ตามหน่วยบริโภค · น้ำเปล่า 0 kcal · กระโดดเก็บสัญลักษณ์ออกกำลังกายเพื่อลด kcal สุทธิ · 1 ชิ้นแทนกิจกรรมจำลอง 15 นาที · เก็บพลาดไม่เปลี่ยนค่า</p></li><li><strong>วิ่งเข้าประตูคำตอบ</strong><p>คำถามและคำตอบอยู่ด้านบน มีประตูแสดงคำตอบ เลือกเลนในช่วง 6 วินาทีก่อนถึงประตู เกมวิ่งต่อและล็อกคำตอบเมื่อผ่านประตู</p></li><li><strong>ผิดติดกัน 3 ข้อจบรอบ</strong><p>ตอบถูกรีเซ็ตการผิดติดกัน ประตูคำถามข้อ 10 คือเส้นชัย จบแล้วทบทวนเหตุผลได้ทั้งเมื่อแพ้และถึงเส้นชัย</p></li></ol><Practice mode={mode} cameraReady={cameraReady} detectedLane={detectedLane} /><p className="lr-muted">เริ่มอาหารสะสมที่ 0 kcal เป้าพลังงานต่อวันคำนวณจากเพศ อายุ ส่วนสูง และน้ำหนัก โดยสมมติว่ามีกิจกรรมน้อย ยอดอาหารในเกมไม่ใช่บันทึกอาหารจริงทั้งวัน</p><button onClick={() => setScreen('ready')}>เข้าใจแล้ว →</button>
      </>}
      {result && <>
        <p className="lr-kicker">ผลรอบนี้</p><h1>{s.record.outcome === 'completed' ? 'ถึงเส้นชัยแล้ว!' : 'มาลองทบทวนกัน'}</h1>
        <p>{s.record.outcome === 'game_over' ? 'Game Over · ตอบผิดติดกัน 3 ข้อ' : s.record.outcome === 'completed' ? 'จบภารกิจเมืองสมดุล' : 'ออกจากรอบก่อนจบ'}</p>
        {!sessionOnly && !storageError && <FeedbackPanel key={s.record.runId} runId={s.record.runId} repository={repository.current} waitForSave={() => writeQueue.current} onChange={() => void syncAnalytics()} />}
        {sessionOnly && <p className="lr-muted">เล่นได้เฉพาะครั้งนี้ · ยังบันทึกคะแนนและดาวถาวรไม่ได้</p>}
        <div className="lr-stat-row"><div><small>คำถามที่ตอบ</small><strong>{s.record.answers.length} / 10</strong><span>ยังไม่ถึง {s.record.unreachedCount} ข้อ</span></div><div><small>ตอบถูก</small><strong>{s.record.correctCount} / {s.record.answers.length}</strong><span>{s.record.answers.length ? Math.round(s.record.correctCount / s.record.answers.length * 100) + '%' : 'ยังไม่มีข้อมูล'}</span></div><div><small>ระยะทางที่เล่น</small><strong>{Math.round(s.distance / LEVEL_DISTANCE * 100)}%</strong><span>ความคืบหน้าในรอบนี้</span></div></div>
        {s.record.outcome === 'game_over' && <div className="lr-last-answer"><strong>เฉลยข้อสุดท้าย: {s.lastAnswer?.options.find(o => o.optionId === s.lastAnswer?.correctOptionId)?.text}</strong><p>{s.lastAnswer?.explanation}</p></div>}
        <EnergyResult snapshot={s} /><h2>ทบทวนคำตอบ</h2>{s.record.answers.map(a => <details className="lr-review" key={a.index}><summary><span className={a.isCorrect ? 'lr-correct' : 'lr-wrong'}>{a.isCorrect ? '✓' : '↻'}</span> {a.index + 1}. {a.prompt}</summary><p>เลือก: {a.options.find(o => o.optionId === a.selectedOptionId)?.text}</p><p>คำตอบ: <strong>{a.options.find(o => o.optionId === a.correctOptionId)?.text}</strong></p><p>{a.explanation}</p></details>)}
        {s.record.unreachedCount > 0 && <p className="lr-muted">อีก {s.record.unreachedCount} ข้อยังไม่ถึง ไม่ถูกนับว่าผิด</p>}
        <details><summary>ตัวเลือกของที่เก็บในรอบ</summary><p>{Object.entries(s.record.itemCounts).map(([key, value]) => `${ITEM_CATALOG[key as keyof typeof ITEM_CATALOG]?.name ?? key} ${value}`).join(' · ') || 'ยังไม่ได้เก็บ item'}</p></details>
        <div className="lr-actions"><button onClick={backToReady}>เล่นอีกครั้ง →</button><button className="secondary" onClick={() => { sessionRef.current = null; setSnapshot(null); edit(profile ?? undefined); }}>แก้ไขข้อมูล</button></div>
      </>}
    </div></div>}
    </div>
    {introOpen && <div className="lr-modal-shade"><section ref={modalRef} className="lr-welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><span className="lr-welcome-icon">✦</span><p className="lr-kicker">WELCOME TO FOOD FIT FUN</p><h2 id="welcome-title">พร้อมสนุกไปด้วยกันไหม?</h2><section><h3>Objective</h3><div>{OBJECTIVE_COPY.map(text => <p key={text}>{text}</p>)}</div></section><p className="lr-data-notice">เมื่อเปิดใช้การส่งข้อมูล ชื่อเล่น เพศ อายุ เป้าพลังงานต่อวันโดยประมาณ พลังงานและรายการอาหารในเกม เวอร์ชันสูตร คะแนนตอบคำถาม คะแนนเกม ดาวความสนุก และความคิดเห็นจะส่งไปเก็บที่ Supabase เพื่อวิเคราะห์รวมหลายเครื่อง ภาพกล้อง ส่วนสูง น้ำหนัก และคำตอบรายข้อเก็บอยู่ในเครื่อง</p><label className="lr-checkbox"><input type="checkbox" checked={introChecked} onChange={e => setIntroChecked(e.target.checked)} />อ่าน Objective แล้ว</label><button disabled={!introChecked} onClick={() => { audio.current?.cue('confirm'); setIntroOpen(false); }}>OK · ไปกันเลย →</button></section></div>}
    {settingsOpen && <div className="lr-modal-shade"><section ref={modalRef} className="lr-settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><p className="lr-kicker">ปรับก่อนออกวิ่ง</p><h2 id="settings-title">SETTINGS</h2>
      <div className="lr-mode"><button className={mode === 'camera' ? 'selected secondary' : 'secondary'} aria-pressed={mode === 'camera'} onClick={() => chooseMode('camera')}><strong>◎ กล้อง</strong><small>ขยับไหล่ซ้าย–ขวา</small></button><button className={mode === 'manual' ? 'selected secondary' : 'secondary'} aria-pressed={mode === 'manual'} onClick={() => chooseMode('manual')}><strong>⌨ คีย์บอร์ด / ปัดจอ</strong><small>← / → หรือ A / D · มือถือปัดซ้าย–ขวา</small></button></div>
      {mode === 'camera' && <div className="lr-camera-setup"><p>{cameraStatus}</p><button className="secondary" onClick={beginCamera}>เปิด / ตั้งกล้อง</button><p className="lr-muted">ยืนนิ่งให้เห็นไหล่ถึงเอว ภาพประมวลผลในเครื่อง</p></div>}
      <div className="lr-quality"><span>คุณภาพภาพ</span>{(['low','medium','high'] as const).map((v,i) => <button className="secondary" aria-pressed={v === quality} key={v} onClick={() => setGraphics(v)}>{['เบา','กลาง','สูง'][i]}</button>)}</div>
      <fieldset className="lr-audio-settings"><legend>เสียงและเอฟเฟกต์</legend>{(['sfx','ambient'] as const).map(channel=><label key={channel}>{channel==='sfx' ? 'เสียงเอฟเฟกต์' : 'เสียงบรรยากาศ'} · {Math.round(audioPreferences[channel]*100)}%<input type="range" min="0" max="1" step="0.05" value={audioPreferences[channel]} onChange={e => { const next={...audioPreferences,[channel]:Number(e.target.value)};setAudioPreferences(next);if(!audio.current?.configure(next))setNotice('ตั้งค่าได้ในรอบนี้ แต่บันทึกลงเครื่องไม่ได้'); }} /></label>)}<div className="lr-actions"><button className="secondary" onClick={() => { const next={...audioPreferences,sfx:0,ambient:0};setAudioPreferences(next);audio.current?.configure(next); }}>ปิดเสียงทั้งหมด</button><button className="secondary" onClick={async () => { await audio.current?.unlock();audio.current?.cue('correct');if(!audio.current?.ready)setNotice('เบราว์เซอร์ยังไม่เปิดเสียง เล่นแบบเงียบได้'); }}>ลองเสียง</button></div><label className="lr-checkbox"><input type="checkbox" checked={audioPreferences.reducedMotion} onChange={e=>{const next={...audioPreferences,reducedMotion:e.target.checked};setAudioPreferences(next);audio.current?.configure(next);}} />ลดการเคลื่อนไหวของเอฟเฟกต์</label></fieldset>
      {profile && <button className="secondary" onClick={() => { forceTutorial.current=true;setSettingsOpen(false);requestPlay(profile); }}>ฝึกอีกครั้ง</button>}
      <p>ชุดคำถามงานวิจัย · สุ่ม 10 ข้อจาก 25 ข้อในแต่ละรอบ</p>
      {data.profiles.length > 0 && <label>ผู้เล่น<select value={profile?.playerId ?? ''} onChange={e => { const p = data.profiles.find(p => p.playerId === e.target.value); if (p) { setProfile(p); avatarRef.current = p.avatar; } }}><option value="">เลือกผู้เล่น</option>{data.profiles.map(p => <option key={p.playerId} value={p.playerId}>{p.nickname}</option>)}</select></label>}
      <div className="lr-actions"><button className="secondary" onClick={() => { setSettingsOpen(false); edit(newProfile()); }}>＋ ผู้เล่นใหม่</button><button onClick={() => setSettingsOpen(false)}>เรียบร้อย ✓</button></div>
      {profile && <button className="lr-link" onClick={() => setDeletePlayer(true)}>ล้างข้อมูลผู้เล่นนี้</button>}
      {deletePlayer && profile && <div className="lr-confirm"><p>ล้างโปรไฟล์ คะแนน ประวัติ ดาว และคิวรอส่งของ {profile.nickname} ในเครื่องนี้? ข้อมูลที่ส่งส่วนกลางแล้วยังอยู่ และอาจถูกถามดาวใหม่</p><div className="lr-actions"><button onClick={async () => { await writeQueue.current; try { await repository.current.clear(profile.playerId);tutorialMemory.current?.clear(profile.playerId); await refresh(); setProfile(null); setDeletePlayer(false); } catch { setNotice('ล้างข้อมูลไม่สำเร็จ'); } }}>ยืนยันล้าง</button><button className="secondary" onClick={() => setDeletePlayer(false)}>ยกเลิก</button></div></div>}
    </section></div>}
  </main>;
}
