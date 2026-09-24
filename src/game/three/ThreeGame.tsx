import React, { useEffect, useRef, useState } from 'react';
import { GameEngine3D, type GraphicsQuality } from './GameEngine3D';
import './ThreeGame.css';
import { BreakfastOption, DecisionDoor } from '../types';
import { soundSynth } from '../audio/SoundSynth';
import { CameraSession, type CameraSessionPhase } from '../camera/CameraSession';
import { PoseMapper, type PoseOutput } from '../camera/PoseMapper';
import { HelpCircle, Zap, Flame, Heart, Smile, RotateCcw, Sparkles, Shield, Rocket, AlertTriangle } from 'lucide-react';

export const ThreeGame: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine3D | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<CameraSession | null>(null);
  const mapperRef = useRef(new PoseMapper());
  const cameraGenerationRef = useRef(0);
  const observedFeedbackRef = useRef(0);
  const cameraTickRef = useRef<() => void>(() => {});
  const startGameRef = useRef<() => void>(() => {});
  const gameStateRef = useRef<'MENU' | 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'GAMEOVER'>('MENU');
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownGenerationRef = useRef(0);
  const inputModeRef = useRef<'manual' | 'camera'>('manual');
  const cameraReadyRef = useRef(false);
  const cameraTrackingRef = useRef(false);
  const handTrackingRef = useRef(false);
  const handMissingSinceRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<'MENU' | 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'GAMEOVER'>('MENU');
  const [countdown, setCountdown] = useState(3);
  const [inputMode, setInputMode] = useState<'manual' | 'camera'>('manual');
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(() => {
    try {
      const saved = window.localStorage.getItem('body-rush-graphics-quality');
      return saved === 'low' || saved === 'high' ? saved : 'medium';
    } catch { return 'medium'; }
  });
  const [feedbackEvent, setFeedbackEvent] = useState<{ id: number; title: string; subtitle: string; kind: 'collect' | 'land' | 'crash' } | null>(null);
  const [bestScore, setBestScore] = useState(0);
  const [shownFinalScore, setShownFinalScore] = useState(0);
  const [gameOverStats, setGameOverStats] = useState<{ score: number; distance: number; biome: string; reason: string } | null>(null);
  const [cameraPhase, setCameraPhase] = useState<CameraSessionPhase>('off');
  const [cameraMessage, setCameraMessage] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraTracking, setCameraTracking] = useState(false);
  const [handTracking, setHandTracking] = useState(false);
  const [poseHint, setPoseHint] = useState<PoseOutput['setupHint']>();
  const [pauseReason, setPauseReason] = useState('');
  const [selectedBreakfast, setSelectedBreakfast] = useState<BreakfastOption>('OATMEAL');
  const [hudStats, setHudStats] = useState({
    energy: 70,
    sugar: 15,
    stamina: 90,
    mood: 75,
    distance: 0,
    score: 0,
    biome: 'CANDY TOWN',
    lives: 3,
    isStumbling: false,
    isSugarOverloaded: false,
    speedAlert: null as string | null,
    enteredGate: null as DecisionDoor | null,
    gameOverReason: ''
  });
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [showCameraGuide, setShowCameraGuide] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const engine = new GameEngine3D(containerRef.current);
    engineRef.current = engine;
    engine.setGraphicsQuality(graphicsQuality);

    engine.previewBreakfast(selectedBreakfast);

    let animId: number;
    let lastHudDispatch = 0;

    const loop = (timestamp: number) => {
      if (engineRef.current) {
        cameraTickRef.current();
        engineRef.current.update();

        if (engineRef.current.isGameOver) {
          if (gameStateRef.current !== 'GAMEOVER') {
            gameStateRef.current = 'GAMEOVER';
            setGameOverStats({
              score: Math.floor(engineRef.current.score),
              distance: Math.floor(engineRef.current.distance),
              biome: engineRef.current.biome,
              reason: engineRef.current.gameOverReason
            });
            cameraGenerationRef.current++;
            cameraRef.current?.stop();
            cameraRef.current = null;
            cameraReadyRef.current = false;
            cameraTrackingRef.current = false;
            setCameraReady(false);
            setCameraTracking(false);
            setCameraPhase('off');
            setGameState('GAMEOVER');
          }
        }

        if (timestamp - lastHudDispatch > 50) {
          lastHudDispatch = timestamp;
          
          setHudStats({
            energy: engineRef.current.status.energy,
            sugar: engineRef.current.status.sugar,
            stamina: engineRef.current.status.stamina,
            mood: engineRef.current.status.mood,
            distance: Math.floor(engineRef.current.distance),
            score: Math.floor(engineRef.current.score),
            biome: engineRef.current.biome,
            lives: engineRef.current.lives,
            isStumbling: engineRef.current.isStumbling,
            isSugarOverloaded: engineRef.current.isSugarOverloaded,
            speedAlert: engineRef.current.speedUpAlert,
            enteredGate: engineRef.current.enteredGatePopup,
            gameOverReason: engineRef.current.gameOverReason
          });
          const nextFeedback = engineRef.current.feedbackEvent;
          if (nextFeedback && observedFeedbackRef.current !== nextFeedback.id) {
            observedFeedbackRef.current = nextFeedback.id;
            setFeedbackEvent(nextFeedback);
          }
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      countdownGenerationRef.current++;
      if (countdownTimerRef.current !== null) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
      cameraGenerationRef.current++;
      cameraRef.current?.stop();
      cameraRef.current = null;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
    if (!feedbackEvent) return;
    const timeout = window.setTimeout(() => setFeedbackEvent(current => current?.id === feedbackEvent.id ? null : current), 1250);
    return () => window.clearTimeout(timeout);
  }, [feedbackEvent]);

  useEffect(() => {
    if (gameState !== 'GAMEOVER') return;
    try {
      const previousBest = Number(window.localStorage.getItem('body-rush-best-score') ?? 0);
      const finalScore = gameOverStats?.score ?? hudStats.score;
      const nextBest = Math.max(Number.isFinite(previousBest) ? previousBest : 0, finalScore);
      if (nextBest !== previousBest) window.localStorage.setItem('body-rush-best-score', String(nextBest));
      setBestScore(nextBest);
    } catch { setBestScore(current => Math.max(current, gameOverStats?.score ?? hudStats.score)); }

    const target = gameOverStats?.score ?? hudStats.score;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShownFinalScore(target);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 950);
      setShownFinalScore(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    setShownFinalScore(0);
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [gameState, hudStats.score, gameOverStats?.score]);

  const handleGraphicsQuality = (quality: GraphicsQuality) => {
    setGraphicsQuality(quality);
    engineRef.current?.setGraphicsQuality(quality);
    try { window.localStorage.setItem('body-rush-graphics-quality', quality); } catch {}
  };

  const changeGameState = (next: typeof gameState) => {
    gameStateRef.current = next;
    setGameState(next);
  };

  const setReady = (ready: boolean) => {
    cameraReadyRef.current = ready;
    setCameraReady(ready);
  };

  const setTracking = (tracking: boolean) => {
    if (cameraTrackingRef.current !== tracking) {
      cameraTrackingRef.current = tracking;
      setCameraTracking(tracking);
    }
  };

  const setHandVisible = (visible: boolean) => {
    if (handTrackingRef.current !== visible) {
      handTrackingRef.current = visible;
      setHandTracking(visible);
    }
  };

  const cancelCountdown = () => {
    countdownGenerationRef.current++;
    if (countdownTimerRef.current !== null) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;
    if (gameStateRef.current === 'COUNTDOWN') changeGameState('MENU');
  };

  const stopCamera = () => {
    cancelCountdown();
    cameraGenerationRef.current++;
    const session = cameraRef.current;
    cameraRef.current = null;
    session?.stop();
    mapperRef.current.reset();
    handMissingSinceRef.current = null;
    setReady(false);
    setTracking(false);
    setHandVisible(false);
    setPoseHint(undefined);
    setCameraPhase('off');
    setCameraMessage('');
  };

  const pauseGame = (reason: string, recalibrate = false) => {
    if (gameStateRef.current !== 'RUNNING') return;
    handMissingSinceRef.current = null;
    engineRef.current?.pause();
    mapperRef.current.resetGesture();
    if (recalibrate || inputModeRef.current === 'camera') {
      mapperRef.current.recalibrate();
      setReady(false);
      setHandVisible(false);
    }
    setPauseReason(reason);
    changeGameState('PAUSED');
  };

  const handlePose = (output: PoseOutput) => {
    setTracking(output.trackingValid && !output.trackingLost);
    setHandVisible(output.handTrackingValid && !output.trackingLost);
    setPoseHint(previous => previous === output.setupHint ? previous : output.setupHint);
    if (output.calibrated !== cameraReadyRef.current) setReady(output.calibrated);
    if (output.trackingLost) {
      if (gameStateRef.current === 'COUNTDOWN') {
        mapperRef.current.recalibrate();
        setReady(false);
        setHandVisible(false);
      }
      cancelCountdown();
      pauseGame('ไม่พบตัวผู้เล่น กรุณากลับมาอยู่ในกรอบกล้อง', true);
      return;
    }
    if (gameStateRef.current === 'RUNNING' && inputModeRef.current === 'camera' && output.trackingValid) {
      if (output.handTrackingValid) {
        handMissingSinceRef.current = null;
      } else {
        const now = performance.now();
        if (handMissingSinceRef.current === null) handMissingSinceRef.current = now;
        if (now - handMissingSinceRef.current >= 300) {
          pauseGame('ไม่เห็นมือในกรอบ จึงตรวจท่าทางไม่ได้ กรุณาจัดมือให้อยู่ในภาพ', true);
          return;
        }
      }
    }
    if (output.jump && gameStateRef.current === 'MENU' && inputModeRef.current === 'camera') {
      startGameRef.current();
      return;
    }
    if (gameStateRef.current !== 'RUNNING' || inputModeRef.current !== 'camera' || !output.trackingValid || !output.calibrated) return;
    if (output.laneChanged && output.lane !== undefined) engineRef.current?.selectLane(output.lane);
    if (output.jump) engineRef.current?.jump();
  };

  cameraTickRef.current = () => {
    if (inputModeRef.current !== 'camera' || !cameraRef.current?.isActive || document.hidden) return;
    const output = mapperRef.current.tick(performance.now());
    if (output.trackingLost) handlePose(output);
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (gameStateRef.current === 'COUNTDOWN') {
          mapperRef.current.recalibrate();
          setReady(false);
          setHandVisible(false);
        }
        cancelCountdown();
        cameraRef.current?.pauseFrames();
        setTracking(false);
        setHandVisible(false);
        pauseGame('แท็บถูกซ่อน กรุณากลับมาอยู่หน้ากล้องแล้วกดเล่นต่อ', true);
      } else {
        cameraRef.current?.resumeFrames();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gameStateRef.current === 'RUNNING') pauseGame('พักเกม');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const chooseMode = (mode: 'manual' | 'camera') => {
    if (mode === 'manual') stopCamera();
    inputModeRef.current = mode;
    setInputMode(mode);
    engineRef.current?.setManualInputEnabled(mode === 'manual');
  };

  const startCamera = () => {
    if (!videoRef.current) return;
    stopCamera();
    chooseMode('camera');
    const generation = ++cameraGenerationRef.current;
    const session = new CameraSession({
      onPhase: (phase, message) => {
        if (generation !== cameraGenerationRef.current) return;
        setCameraPhase(phase);
        setCameraMessage(message ?? '');
        if (phase === 'error') {
          cancelCountdown();
          setTracking(false);
          pauseGame(message ?? 'กล้องหยุดทำงาน', true);
        }
      },
      onPose: (landmarks, timestampMs) => {
        if (generation !== cameraGenerationRef.current || document.hidden) return;
        handlePose(mapperRef.current.ingest(landmarks, timestampMs, performance.now()));
      },
      onInterrupted: message => {
        if (generation === cameraGenerationRef.current) {
          cancelCountdown();
          pauseGame(message, true);
        }
      }
    });
    cameraRef.current = session;
    void session.start(videoRef.current);
  };

  const resumeGame = () => {
    if (gameStateRef.current !== 'PAUSED' || document.hidden) return;
    if (inputModeRef.current === 'camera' && (!cameraRef.current?.isActive || !cameraReadyRef.current || !cameraTrackingRef.current || !handTrackingRef.current)) return;
    mapperRef.current.resetGesture();
    engineRef.current?.resume();
    if (inputModeRef.current === 'camera') engineRef.current?.selectLane(1);
    setPauseReason('');
    changeGameState('RUNNING');
  };

  const switchToManual = () => {
    chooseMode('manual');
    if (gameStateRef.current === 'PAUSED') {
      engineRef.current?.resume();
      setPauseReason('');
      changeGameState('RUNNING');
    }
  };

  const handleSelectBreakfast = (opt: BreakfastOption) => {
    setSelectedBreakfast(opt);
    if (engineRef.current) {
      engineRef.current.previewBreakfast(opt);
      try {
        soundSynth.playPickup('WATER');
      } catch (e) {}
    }
  };

  const startGame = () => {
    if (gameStateRef.current !== 'MENU') return;
    setGameOverStats(null);
    setShownFinalScore(0);
    if (inputModeRef.current === 'camera' && (!cameraRef.current?.isActive || !cameraReadyRef.current || !cameraTrackingRef.current || !handTrackingRef.current)) return;
    if (inputModeRef.current === 'camera') {
      cancelCountdown();
      const generation = ++countdownGenerationRef.current;
      let secondsLeft = 3;
      setCountdown(secondsLeft);
      changeGameState('COUNTDOWN');
      countdownTimerRef.current = setInterval(() => {
        if (generation !== countdownGenerationRef.current) return;
        if (document.hidden || !cameraRef.current?.isActive || !cameraReadyRef.current || !cameraTrackingRef.current || !handTrackingRef.current) {
          cancelCountdown();
          return;
        }
        secondsLeft--;
        if (secondsLeft > 0) {
          setCountdown(secondsLeft);
          return;
        }
        cancelCountdown();
        if (!engineRef.current) return;
        engineRef.current.initBreakfast(selectedBreakfast);
        engineRef.current.setManualInputEnabled(false);
        mapperRef.current.resetGesture();
        changeGameState('RUNNING');
      }, 1000);
      return;
    }
    if (engineRef.current) {
      engineRef.current.initBreakfast(selectedBreakfast);
      engineRef.current.setManualInputEnabled(inputModeRef.current === 'manual');
      mapperRef.current.resetGesture();
      changeGameState('RUNNING');
    }
  };
  startGameRef.current = startGame;

  const returnToMainMenu = () => {
    cancelCountdown();
    stopCamera();
    inputModeRef.current = 'manual';
    setInputMode('manual');
    if (engineRef.current) {
      engineRef.current.resetToMenu();
      engineRef.current.setManualInputEnabled(true);
      changeGameState('MENU');
    }
  };

  const cameraInstruction = cameraPhase === 'error' || cameraPhase === 'requesting' || cameraPhase === 'loading'
    ? cameraMessage
    : poseHint === 'show-upper-body'
      ? 'จัดกล้องให้เห็นช่วงไหล่ถึงเอวและแขนทั้งสองข้าง'
      : poseHint === 'show-hand' || (cameraPhase === 'active' && cameraTracking && !handTracking)
        ? 'ขยับมือทั้งสองข้างให้อยู่ในกรอบกล้อง'
        : poseHint === 'stand-still'
          ? 'ยืนกลางกรอบให้นิ่งประมาณ 1.5 วินาที'
          : cameraPhase === 'active' && cameraReady && cameraTracking
            ? 'พร้อมแล้ว! เอนตัวเลือกเลน; ยกมือข้างเดียวค้างเพื่อเริ่มเกมหรือกระโดด แล้วลดมือลงก่อนทำซ้ำ'
            : cameraPhase === 'active'
              ? 'ยืนกลางกรอบให้นิ่ง รอให้กล้องตั้งท่ากลาง'
              : 'กดเปิดกล้องเพื่อตั้งท่ากลาง';

  const finalStats = gameOverStats ?? {
    score: hudStats.score,
    distance: hudStats.distance,
    biome: hudStats.biome,
    reason: hudStats.gameOverReason
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#0f172a',
        zIndex: 1
      }}
    >
      {/* 3D WebGL Canvas Viewport Container (Full Screen) */}
      <div 
        ref={containerRef} 
        style={{ width: '100vw', height: '100vh', position: 'absolute', inset: 0, zIndex: 1 }}
      />

      {/* Keep the same video element mounted across menu, play and pause. */}
      <div className="br-camera-preview" style={{ position: 'absolute', right: '16px', top: gameState === 'MENU' || gameState === 'PAUSED' || gameState === 'COUNTDOWN' ? '16px' : 'auto', bottom: gameState === 'MENU' || gameState === 'PAUSED' || gameState === 'COUNTDOWN' ? 'auto' : '70px', width: gameState === 'MENU' || gameState === 'PAUSED' || gameState === 'COUNTDOWN' ? '200px' : '160px', zIndex: gameState === 'PAUSED' || gameState === 'COUNTDOWN' ? 60 : gameState === 'MENU' ? 50 : 39, display: inputMode === 'camera' && gameState !== 'GAMEOVER' && cameraPhase !== 'off' ? 'block' : 'none', border: '3px solid #38bdf8', borderRadius: '14px', overflow: 'hidden', background: '#0f172a', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
        <div style={{ position: 'relative' }}>
        <video ref={videoRef} autoPlay muted playsInline style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: '8% 14% 4%', border: '2px dashed rgba(255,255,255,.9)', borderRadius: '40% 40% 18% 18%', boxShadow: '0 0 0 999px rgba(15,23,42,.12)', pointerEvents: 'none' }} />
        </div>
        <div style={{ padding: '4px', color: '#fff', fontSize: '11px', textAlign: 'center', background: cameraTracking && handTracking ? '#166534' : '#9a3412' }}>
          {cameraTracking && handTracking ? 'เห็นช่วงตัวและมือ พร้อมควบคุม' : cameraTracking ? 'ไม่เห็นมือ: ยื่นมือเข้ามาในกรอบ' : 'จัดภาพให้เห็นไหล่ถึงเอว'}
        </div>
      </div>

      {/* STUMBLE RED FLASH PENALTY VIGNETTE */}
      {hudStats.isStumbling && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(239, 68, 68, 0.45)',
            zIndex: 30,
            pointerEvents: 'none',
            border: '14px solid #ef4444'
          }}
        />
      )}

      {/* SUGAR OVERLOAD PULSING VIGNETTE */}
      {hudStats.isSugarOverloaded && !hudStats.isStumbling && gameState === 'RUNNING' && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 70px rgba(219, 39, 119, 0.55)',
            border: '6px solid rgba(244, 114, 182, 0.6)',
            zIndex: 28,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* SPEED UP ANNOUNCEMENT BANNER */}
      {hudStats.speedAlert && gameState === 'RUNNING' && (
        <div 
          style={{
            position: 'absolute',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 36,
            backgroundColor: 'rgba(234, 179, 8, 0.95)',
            border: '3px solid #ffffff',
            borderRadius: '9999px',
            padding: '8px 28px',
            color: '#713f12',
            fontWeight: '900',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '13px',
            boxShadow: '0 10px 25px rgba(234, 179, 8, 0.5)',
            pointerEvents: 'none'
          }}
        >
          {hudStats.speedAlert}
        </div>
      )}

      {/* SUGAR OVERLOAD WARNING BADGE */}
      {hudStats.isSugarOverloaded && gameState === 'RUNNING' && (
        <div 
          style={{
            position: 'absolute',
            top: '78px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 38,
            backgroundColor: 'rgba(225, 29, 72, 0.95)',
            border: '3px solid #ffffff',
            borderRadius: '16px',
            padding: '6px 20px',
            color: '#ffffff',
            fontWeight: 'bold',
            fontFamily: '"Chakra Petch", sans-serif',
            fontSize: '12px',
            boxShadow: '0 8px 20px rgba(225, 29, 72, 0.6)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={18} color="#fef08a" />
          <span>⚠️ SUGAR OVERLOAD: เลี้ยวอืดหน่วง (SLUGGISH) & สะดุดเสีย 2 หัวใจ! ดื่มน้ำ 💧 ด่วน!</span>
        </div>
      )}

      {gameState === 'RUNNING' && feedbackEvent && (
        <div className={`br-run-feedback is-${feedbackEvent.kind}`} role="status" aria-live="polite" key={feedbackEvent.id}>
          <span className="br-feedback-icon">{feedbackEvent.kind === 'crash' ? '!' : feedbackEvent.kind === 'land' ? '↓' : '✦'}</span>
          <span><strong>{feedbackEvent.title}</strong><small>{feedbackEvent.subtitle}</small></span>
        </div>
      )}

      {/* ✨ ENTERED GATE VICTORY FLASH BANNER ✨ */}
      {hudStats.enteredGate && (
        <div 
          style={{
            position: 'absolute',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 42,
            backgroundColor: hudStats.enteredGate.type === 'FAST_FOOD' ? '#ea580c' : hudStats.enteredGate.type === 'HEALTHY' ? '#16a34a' : '#0284c7',
            border: '3px solid #ffffff',
            borderRadius: '20px',
            padding: '12px 28px',
            color: '#ffffff',
            textAlign: 'center',
            boxShadow: '0 15px 30px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'none',
            fontFamily: '"Chakra Petch", sans-serif'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: '900', fontFamily: '"Press Start 2P", monospace', marginBottom: '2px' }}>
            <Sparkles size={18} /> {hudStats.enteredGate.title} GATE!
          </div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fef08a' }}>
            {hudStats.enteredGate.statsEffect}
          </div>
        </div>
      )}

      {/* TOP FLOATING IN-GAME HUD & STATUS BARS (NO HEADER) */}
      {gameState === 'RUNNING' && (
        <div className="br-hud"
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '92%',
            maxWidth: '1020px'
          }}
        >
          <div 
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              border: '3px solid #f472b6',
              borderRadius: '20px',
              padding: '8px 16px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              width: '100%'
            }}
          >
            <div className="br-biome-chip"><small>ZONE {Math.floor(hudStats.distance / 1000) + 1}</small><strong>{hudStats.biome}</strong></div>
            {/* 💖 3 HEARTS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingRight: '10px', borderRight: '1px solid rgba(255, 255, 255, 0.2)' }}>
              {[1, 2, 3].map((heartIndex) => (
                <span 
                  key={heartIndex} 
                  style={{
                    fontSize: '20px',
                    filter: heartIndex <= hudStats.lives ? 'none' : 'grayscale(100%) opacity(30%)',
                    transform: heartIndex <= hudStats.lives ? 'scale(1)' : 'scale(0.85)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  💖
                </span>
              ))}
            </div>

            {/* 4 BARS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', flex: 1, fontFamily: '"Chakra Petch", sans-serif' }}>
              {/* ENERGY */}
              <div style={{ backgroundColor: '#1e293b', padding: '5px 10px', borderRadius: '10px', border: '1px solid #fbbf24' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: '900', color: '#fbbf24', marginBottom: '3px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Zap size={12} color="#fbbf24" /> ENERGY</span>
                  <span style={{ fontFamily: 'monospace', color: hudStats.energy < 25 ? '#ef4444' : '#ffffff', fontWeight: 'bold' }}>
                    {Math.round(hudStats.energy)}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#0f172a', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, hudStats.energy))}%`, height: '100%', background: hudStats.energy < 25 ? '#ef4444' : 'linear-gradient(90deg, #f59e0b, #fde047)', borderRadius: '9999px', transition: 'width 0.15s ease' }} />
                </div>
              </div>

              {/* SUGAR */}
              <div style={{ backgroundColor: '#1e293b', padding: '5px 10px', borderRadius: '10px', border: hudStats.isSugarOverloaded ? '2px solid #ef4444' : '1px solid #f472b6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: '900', color: '#f472b6', marginBottom: '3px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Flame size={12} color="#f472b6" /> SUGAR</span>
                  <span style={{ fontFamily: 'monospace', color: hudStats.isSugarOverloaded ? '#ef4444' : '#ffffff', fontWeight: 'bold' }}>
                    {Math.round(hudStats.sugar)}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#0f172a', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, hudStats.sugar))}%`, height: '100%', background: hudStats.isSugarOverloaded ? 'linear-gradient(90deg, #ec4899, #ef4444)' : 'linear-gradient(90deg, #d946ef, #f472b6)', borderRadius: '9999px', transition: 'width 0.15s ease' }} />
                </div>
              </div>

              {/* STAMINA */}
              <div style={{ backgroundColor: '#1e293b', padding: '5px 10px', borderRadius: '10px', border: '1px solid #38bdf8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: '900', color: '#38bdf8', marginBottom: '3px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Heart size={12} color="#38bdf8" /> STAMINA</span>
                  <span style={{ fontFamily: 'monospace', color: '#ffffff', fontWeight: 'bold' }}>{Math.round(hudStats.stamina)}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#0f172a', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, hudStats.stamina))}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7, #38bdf8)', borderRadius: '9999px', transition: 'width 0.15s ease' }} />
                </div>
              </div>

              {/* MOOD */}
              <div style={{ backgroundColor: '#1e293b', padding: '5px 10px', borderRadius: '10px', border: '1px solid #c084fc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: '900', color: '#c084fc', marginBottom: '3px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Smile size={12} color="#c084fc" /> MOOD</span>
                  <span style={{ fontFamily: 'monospace', color: '#ffffff', fontWeight: 'bold' }}>{Math.round(hudStats.mood)}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#0f172a', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, hudStats.mood))}%`, height: '100%', background: 'linear-gradient(90deg, #9333ea, #f472b6)', borderRadius: '9999px', transition: 'width 0.15s ease' }} />
                </div>
              </div>
            </div>

            {/* SCORE + DISTANCE */}
            <div className="br-score-chip"><small>SCORE</small><strong>{hudStats.score.toLocaleString()}</strong></div>
            <div style={{ textAlign: 'right', paddingLeft: '10px', borderLeft: '1px solid rgba(255, 255, 255, 0.2)' }}>
              <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'bold' }}>DIST</div>
              <div style={{ fontSize: '14px', fontWeight: '900', fontFamily: '"Press Start 2P", monospace', color: '#fbbf24' }}>
                {hudStats.distance}m
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main menu */}
      {gameState === 'MENU' && (
        <section className="br-menu" aria-label="เมนูหลัก">
          <div className="br-menu-shell">
            <header className="br-hero">
              <div className="br-eyebrow"><span className="br-live-dot" /> ARCADE RUNNER <span>•</span> BODY BALANCE LAB</div>
              <h1><span>BODY</span> RUSH <sup>3D</sup></h1>
              <p>วิ่งให้ไกล เลือกให้สมดุล แล้วดูแลร่างกายระหว่างทาง</p>
            </header>

            <div className="br-quality-control" role="group" aria-label="คุณภาพกราฟิก">
              <span>คุณภาพภาพ</span>
              {(['low', 'medium', 'high'] as const).map(level => (
                <button key={level} type="button" aria-pressed={graphicsQuality === level} className={graphicsQuality === level ? 'is-active' : ''} onClick={() => handleGraphicsQuality(level)}>
                  {level === 'low' ? 'ประหยัด' : level === 'medium' ? 'สมดุล' : 'สูง'}
                </button>
              ))}
            </div>

            <div className="br-menu-grid">
              <section className="br-panel br-breakfast-panel" aria-labelledby="breakfast-title">
                <div className="br-section-heading">
                  <div><span className="br-step">01 / LOADOUT</span><h2 id="breakfast-title">เลือกมื้อเช้า</h2></div>
                  <span className="br-heading-note">เลือกสไตล์ก่อนออกวิ่ง</span>
                </div>
                <div className="br-food-grid">
                  {([
                    { id: 'DONUT' as const, emoji: '🍩', title: 'DONUT', detail: 'สปีดจัด แต่น้ำตาลสูง', effect: '+10% BASE SPEED', icon: <Rocket size={14} />, accent: 'rose' },
                    { id: 'OATMEAL' as const, emoji: '🥣', title: 'OATMEAL', detail: 'อึดและสมดุล', effect: 'SLOW STAMINA DECAY', icon: <Shield size={14} />, accent: 'cyan' },
                    { id: 'EGG' as const, emoji: '🍳', title: 'EGG', detail: 'พลังงานเริ่มต้นสูง', effect: '+95% MAX ENERGY', icon: <Zap size={14} />, accent: 'amber' }
                  ]).map(food => (
                    <button key={food.id} type="button" className={`br-food-card br-${food.accent} ${selectedBreakfast === food.id ? 'is-selected' : ''}`} onClick={() => handleSelectBreakfast(food.id)} aria-pressed={selectedBreakfast === food.id}>
                      <span className="br-food-top"><span className="br-food-emoji">{food.emoji}</span><span className="br-radio" /></span>
                      <strong>{food.title}</strong><span className="br-food-detail">{food.detail}</span>
                      <span className="br-effect">{food.icon}{food.effect}</span>
                    </button>
                  ))}
                </div>
              </section>

              <aside className="br-panel br-play-panel">
                <div className="br-section-heading">
                  <div><span className="br-step">02 / CONTROL</span><h2>เลือกวิธีเล่น</h2></div>
                </div>
                <div className="br-mode-switch" role="group" aria-label="วิธีควบคุม">
                  <button type="button" onClick={() => chooseMode('manual')} aria-pressed={inputMode === 'manual'} className={inputMode === 'manual' ? 'is-active' : ''}><span>⌨</span><span>คีย์บอร์ด<small>เล่นได้ทันที</small></span></button>
                  <button type="button" onClick={() => chooseMode('camera')} aria-pressed={inputMode === 'camera'} className={inputMode === 'camera' ? 'is-active' : ''}><span>◎</span><span>กล้อง<small>ใช้ท่าทางร่างกาย</small></span></button>
                </div>
                {inputMode === 'camera' && (
                  <div className="br-camera-setup">
                    <div className="br-camera-title"><span className="br-camera-icon">◎</span><div><strong>ตั้งค่ากล้อง</strong><small>วางเว็บแคมให้เห็นช่วงตัวและแขน</small></div></div>
                    <div className={`br-camera-status ${cameraReady && cameraTracking && handTracking ? 'is-ready' : cameraPhase === 'error' ? 'has-error' : ''}`} role="status" aria-live="polite"><span className="br-status-dot" />{cameraInstruction}</div>
                    <div className="br-camera-actions">
                      <button type="button" className="br-text-button" onClick={() => setShowCameraGuide(true)}>▶ ดูท่าสาธิต</button>
                      {cameraPhase === 'off' || cameraPhase === 'error' ? <button type="button" className="br-outline-button" onClick={startCamera}>{cameraPhase === 'error' ? 'ลองใหม่' : 'เปิดกล้อง'}</button> : <button type="button" className="br-outline-button" onClick={stopCamera}>ปิดกล้อง</button>}
                    </div>
                  </div>
                )}
                {inputMode === 'manual' && <div className="br-manual-hint"><span>SPACE</span> กระโดด <i>·</i> <span>← →</span> เปลี่ยนเลน</div>}
              </aside>
            </div>

            <footer className="br-menu-footer">
              <div className="br-footer-note"><span className="br-footer-star">✦</span><span>เก็บดาว • หลบสิ่งกีดขวาง • รักษาสมดุล</span></div>
              <div className="br-primary-actions">
                <button type="button" className="br-start-button" onClick={startGame} disabled={inputMode === 'camera' && !(cameraPhase === 'active' && cameraReady && cameraTracking && handTracking)}><span>เริ่มวิ่ง</span><span className="br-start-arrow">→</span></button>
                <button type="button" className="br-help-button" onClick={() => setShowHowToPlay(true)}><HelpCircle size={17} /> วิธีเล่น</button>
              </div>
              {inputMode === 'camera' && <p className="br-gesture-note">พร้อมแล้ว: ยกมือข้างเดียวเพื่อเริ่ม • ระหว่างวิ่งยกมือเพื่อกระโดด</p>}
            </footer>
          </div>
        </section>
      )}

      {gameState === 'COUNTDOWN' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 55, display: 'grid', placeItems: 'center', background: 'rgba(15,23,42,.8)', color: '#fff', textAlign: 'center', fontFamily: '"Chakra Petch", sans-serif' }}>
          <div>
            <p style={{ fontSize: '22px', fontWeight: 'bold' }}>กลับมายืนกลางกรอบ เตรียมเริ่มวิ่ง</p>
            <p aria-live="polite" style={{ color: '#fde68a' }}>{cameraInstruction}</p>
            <div aria-live="assertive" style={{ fontSize: 'clamp(90px, 20vw, 180px)', lineHeight: 1.1, fontWeight: 900, color: '#fde047', textShadow: '0 8px 30px rgba(0,0,0,.6)' }}>{countdown}</div>
            <button onClick={returnToMainMenu} style={{ padding: '10px 20px', borderRadius: '12px', cursor: 'pointer' }}>ยกเลิกและกลับเมนู</button>
          </div>
        </div>
      )}

      {gameState === 'RUNNING' && (
        <button onClick={() => pauseGame('พักเกม')} style={{ position: 'absolute', top: '84px', right: '16px', zIndex: 45, background: '#1e293b', color: '#fff', border: '2px solid #fff', borderRadius: '12px', padding: '8px 12px', cursor: 'pointer' }}>Ⅱ พักเกม</button>
      )}
      {gameState === 'RUNNING' && inputMode === 'camera' && !handTracking && (
        <div role="status" style={{ position: 'absolute', top: '132px', right: '16px', zIndex: 45, maxWidth: '250px', padding: '8px 12px', borderRadius: '12px', border: '2px solid #fbbf24', background: '#78350f', color: '#fff', fontFamily: '"Chakra Petch", sans-serif', fontWeight: 'bold', fontSize: '13px' }}>
          ไม่เห็นมือในกรอบ ตรวจท่าทางไม่ได้ — ยื่นมือให้อยู่ในภาพ
        </div>
      )}

      {gameState === 'PAUSED' && (
        <div className="br-dialog-backdrop" style={{ position: 'absolute', inset: 0, zIndex: 55, display: 'grid', placeItems: 'center', padding: '20px', background: 'rgba(15,23,42,.85)', fontFamily: '"Chakra Petch", sans-serif' }}>
          <div className="br-dialog-card" style={{ width: 'min(440px, 100%)', padding: '26px', border: '3px solid #38bdf8', borderRadius: '22px', background: '#0f172a', color: '#fff', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,.5)' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>เกมพักอยู่</h2>
            <p aria-live="polite" style={{ marginBottom: '12px' }}>{pauseReason}</p>
            {inputMode === 'camera' && <p style={{ color: cameraReady && cameraTracking && handTracking ? '#86efac' : '#fde68a', marginBottom: '14px' }}>{cameraInstruction}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
              <button onClick={resumeGame} disabled={inputMode === 'camera' && !(cameraPhase === 'active' && cameraReady && cameraTracking && handTracking)} style={{ padding: '10px 16px', borderRadius: '10px', cursor: 'pointer' }}>▶ เล่นต่อ</button>
              {inputMode === 'camera' && <button onClick={() => { mapperRef.current.recalibrate(); setReady(false); setTracking(false); }} style={{ padding: '10px 16px', borderRadius: '10px', cursor: 'pointer' }}>ตั้งท่ากลางใหม่</button>}
              {inputMode === 'camera' && <button onClick={() => setShowCameraGuide(true)} style={{ padding: '10px 16px', borderRadius: '10px', cursor: 'pointer' }}>ดูวิธีเล่น</button>}
              {inputMode === 'camera' && <button onClick={switchToManual} style={{ padding: '10px 16px', borderRadius: '10px', cursor: 'pointer' }}>ใช้คีย์บอร์ด</button>}
              {inputMode === 'camera' && cameraPhase === 'error' && <button onClick={startCamera} style={{ padding: '10px 16px', borderRadius: '10px', cursor: 'pointer' }}>เปิดกล้องอีกครั้ง</button>}
              <button onClick={returnToMainMenu} style={{ padding: '10px 16px', borderRadius: '10px', cursor: 'pointer' }}>กลับเมนู</button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {gameState === 'GAMEOVER' && (
        <div className="br-dialog-backdrop"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(12px)',
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            textAlign: 'center',
            fontFamily: '"Chakra Petch", sans-serif'
          }}
        >
          <div className="br-dialog-card br-gameover-card" style={{ backgroundColor: '#ffffff', border: '5px solid #ef4444', borderRadius: '28px', maxWidth: '500px', width: '100%', padding: '28px', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '8px' }}>💥</div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '900', fontFamily: '"Press Start 2P", monospace', color: '#dc2626', marginBottom: '8px' }}>
              GAME OVER
            </h2>
            <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#64748b', marginBottom: '18px' }}>
              {finalStats.reason || 'ร่างกายหมดสภาพจากการวิ่ง!'}
            </p>

            <div className="br-result-stats" style={{ backgroundColor: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '18px', padding: '16px', marginBottom: '22px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>TOTAL DISTANCE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', fontFamily: '"Press Start 2P", monospace', color: '#d97706' }}>
                  {finalStats.distance}m
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>FINAL SCORE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '900', fontFamily: '"Press Start 2P", monospace', color: '#059669' }}>
                  {shownFinalScore.toLocaleString()}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>PERSONAL BEST</div>
                <div className="br-record-score">{Math.max(bestScore, finalStats.score).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>FINAL ZONE</div>
                <div className="br-record-zone">{finalStats.biome}</div>
              </div>
            </div>

            <button
              onClick={returnToMainMenu}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#ec4899',
                border: '4px solid #ffffff',
                borderRadius: '18px',
                color: '#ffffff',
                fontWeight: '900',
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 10px 25px rgba(236, 72, 153, 0.5)'
              }}
            >
              <RotateCcw size={20} /> TRY AGAIN (MAIN MENU)
            </button>
          </div>
        </div>
      )}

      {showCameraGuide && (
        <div className="br-dialog-backdrop" role="dialog" aria-modal="true" aria-label="วิธีเล่นด้วยกล้อง" style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(15,23,42,.94)', display: 'grid', placeItems: 'center', padding: '20px', overflowY: 'auto' }}>
          <style>{`@keyframes cameraRaiseHandDemo { 0%, 15%, 85%, 100% { transform: translateY(0) rotate(0); } 45%, 60% { transform: translateY(-8px) rotate(-8deg); } } .camera-raise-hand-demo { display: inline-block; animation: cameraRaiseHandDemo 2s ease-in-out infinite; } @media (prefers-reduced-motion: reduce) { .camera-raise-hand-demo { animation: none; } }`}</style>
          <div className="br-dialog-card" style={{ width: 'min(680px, 100%)', background: '#fff', border: '4px solid #38bdf8', borderRadius: '24px', padding: '24px', fontFamily: '"Chakra Petch", sans-serif', color: '#0f172a', textAlign: 'center' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '6px' }}>เล่นด้วยกล้อง</h2>
            <p style={{ marginBottom: '20px' }}>จัดกล้องให้เห็นช่วงไหล่ถึงเอวและมือทั้งสองข้าง</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ border: '2px solid #38bdf8', borderRadius: '16px', padding: '14px', background: '#f0f9ff' }}>
                <div aria-hidden="true" style={{ fontSize: '52px', lineHeight: 1.4 }}>🧍</div>
                <strong>1. ยืนกลางภาพ</strong>
                <p style={{ fontSize: '14px', marginTop: '6px' }}>เห็นไหล่ถึงเอวและมือทั้งสองข้าง ยืนนิ่งประมาณ 1.5 วินาทีเพื่อบันทึกท่ากลาง</p>
              </div>
              <div style={{ border: '2px solid #f472b6', borderRadius: '16px', padding: '14px', background: '#fdf2f8' }}>
                <div aria-hidden="true" style={{ fontSize: '42px', lineHeight: 1.7 }}>⬅️ 🧍 ➡️</div>
                <strong>2. เอนตัวเลือกเลน</strong>
                <p style={{ fontSize: '14px', marginTop: '6px' }}>เอนซ้ายเพื่อไปเลนซ้าย เอนขวาเพื่อไปเลนขวา กลับกลางเพื่อเข้าเลนกลาง</p>
              </div>
              <div style={{ border: '2px solid #fbbf24', borderRadius: '16px', padding: '14px', background: '#fffbeb' }}>
                <div aria-hidden="true" style={{ height: '76px', display: 'grid', placeItems: 'center', borderBottom: '3px solid #92400e', marginBottom: '8px' }}><span className="camera-raise-hand-demo" style={{ fontSize: '48px', lineHeight: 1 }}>🙋</span></div>
                <strong>3. ยกมือเริ่ม / กระโดด</strong>
                <p style={{ fontSize: '14px', marginTop: '6px' }}>ที่หน้าเมนูยกมือข้างเดียวค้างสักครู่เพื่อเริ่มเกม ระหว่างเล่นยกค้างเพื่อกระโดดในเกม แล้วลดมือลงก่อนยกซ้ำ</p>
              </div>
            </div>
            <button onClick={() => setShowCameraGuide(false)} style={{ padding: '12px 24px', border: 0, borderRadius: '12px', background: '#0284c7', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>เข้าใจแล้ว</button>
          </div>
        </div>
      )}

      {/* HOW TO PLAY MODAL */}
      {showHowToPlay && (
        <div className="br-dialog-backdrop" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(10px)', zIndex: 65, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="br-dialog-card" style={{ backgroundColor: '#ffffff', border: '4px solid #f472b6', borderRadius: '24px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 25px 40px rgba(0, 0, 0, 0.5)', fontFamily: '"Chakra Petch", sans-serif' }}>
            <h2 className="candy-text-pink" style={{ fontSize: '1.2rem', fontWeight: '900', fontFamily: '"Press Start 2P", monospace', marginBottom: '16px', textAlign: 'center' }}>
              HOW TO PLAY & PENALTIES
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#fdf2f8', borderRadius: '12px', border: '1px solid #fbcfe8' }}>
                <span style={{ fontSize: '1.5rem' }}>💖</span>
                <div>
                  <div style={{ fontWeight: '900', color: '#be185d' }}>ระบบหัวใจ 3 ดวง (3 Lives)</div>
                  <div>สะดุดรั้วเสีย 1 หัวใจ (ถ้าน้ำตาลสูงเกิน 75% ร่างกายเปราะบางจะเสียถึง 2 หัวใจ!)</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: '900', color: '#92400e' }}>บทลงโทษน้ำตาลสูง (Sugar Overload &gt; 75%)</div>
                  <div>เลี้ยวเปลี่ยนเลนจะอืดหน่วงหนักตัว (Sluggish) และเผาผลาญ Energy ไวขึ้น 2 เท่า!</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                <span style={{ fontSize: '1.5rem' }}>🚪</span>
                <div>
                  <div style={{ fontWeight: '900', color: '#0369a1' }}>ประตูทางเลือกชีวิต (ทุก 1 กม.)</div>
                  <div>เลือกประตูที่ให้ผลประโยชน์และข้อแลกเปลี่ยนสมดุล (ไม่มีปุ่มโกงฟื้นฟูฟรี!)</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#fefce8', borderRadius: '12px', border: '1px solid #fef08a' }}>
                <span style={{ fontSize: '1.5rem' }}>⭐</span>
                <div>
                  <div style={{ fontWeight: '900', color: '#a16207' }}>กระโดดข้ามรั้ว 🚧 & เก็บดาว ⭐</div>
                  <div>กด Spacebar / ▲ เพื่อกระโดดข้ามรั้วเตี้ย หรือแตะดาวทองรับ +500 PTS!</div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowHowToPlay(false)}
              style={{ width: '100%', padding: '14px', backgroundColor: '#ec4899', borderRadius: '14px', border: 'none', fontWeight: 'bold', fontFamily: '"Press Start 2P", monospace', fontSize: '13px', color: '#ffffff', cursor: 'pointer' }}
            >
              เข้าใจแล้ว! (GOT IT)
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM CONTROLS HINT (FLOATING) */}
      {gameState === 'RUNNING' && (
        <div 
          style={{
            position: 'absolute',
            bottom: '18px',
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 35,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            color: '#ffffff',
            backdropFilter: 'blur(6px)',
            border: '1.5px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '9999px',
            padding: '8px 24px',
            fontSize: '12px',
            fontWeight: 'bold',
            fontFamily: '"Chakra Petch", sans-serif',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          {inputMode === 'camera' ? <span>เอนตัวซ้าย–ขวา : เปลี่ยนเลน　|　ยกมือค้าง : เริ่มเกม / กระโดด (ลดมือลงก่อนทำซ้ำ)</span> : <><span>◄ / ► : เปลี่ยนเลน</span><span>|</span><span>SPACE : กระโดดข้ามรั้ว 🚧 / เก็บดาว ⭐</span></>}
        </div>
      )}
    </div>
  );
};
