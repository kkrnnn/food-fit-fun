import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CameraPreview, CameraTuningControls, CameraProblemDialog } from '../../src/features/learning/CameraSetup';
import { PoseMapper, type PoseLandmark } from '../../src/game/camera/PoseMapper';
import type { CameraTuning } from '../../src/game/camera/CameraTuning';
import '../../src/features/learning/LearningGame.css';
function Preview() {
  const [state, setState] = useState('ready'), [problem, setProblem] = useState(false), [tuning, setTuning] = useState<CameraTuning>({ lane: 'normal', jump: 'normal' });
  const videoRef = useRef<HTMLVideoElement>(null), firstVideo = useRef<HTMLVideoElement | null>(null);
  const setupHost = useRef<HTMLDivElement>(null), floatingHost = useRef<HTMLDivElement>(null), problemHost = useRef<HTMLDivElement>(null);
  const [sameVideo, setSameVideo] = useState(true);
  useEffect(() => { firstVideo.current ??= videoRef.current; setSameVideo(firstVideo.current === videoRef.current); }, [problem, state]);
  const points: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: .5, y: .6, visibility: 1 }));
  for (const [index, x, y] of [[11,.38,.35],[12,.62,.35],[13,.3,.52],[14,.7,.52],[15,.3,.7],[16,.7,.7],[23,.4,.77],[24,.6,.77]]) points[index] = { x, y, visibility: 1 };
  const mapper = new PoseMapper();
  for (let time = 0; time <= (state === 'calibrating' ? 750 : 1500); time += 125) mapper.ingest(points, time);
  const output = state === 'lost' ? mapper.tick(2000) : mapper.ingest(points, state === 'calibrating' ? 875 : 1625);
  const ready = state !== 'lost' && state !== 'calibrating';
  const status = state === 'calibrating' ? 'ยืนนิ่งตรงกลาง 1.5 วินาที เพื่อตั้งท่ากลาง' : state === 'lost' ? 'ไม่พบตัวผู้เล่น · กลับมาให้เห็นไหล่ถึงเอว' : 'กล้องพร้อมใช้งาน';
  return <main className="lr-game lr-camera-mode" style={{ position: 'relative', overflow: 'hidden', boxSizing: 'border-box', height: '100dvh', padding: 18, background: '#ede8f6' }}>
    <div ref={floatingHost} hidden />
    <CameraPreview placement={problem ? 'problem' : 'settings'} setupHost={setupHost} problemHost={problemHost} floatingHost={floatingHost} videoRef={videoRef} on status={status} output={output} jumped={state === 'ready'} compact={problem} />
    <section className="lr-settings-modal lr-camera-settings-modal" style={{ margin: '0 auto', maxHeight: '100%' }}>
      <p className="lr-kicker">QA · ท่าจำลอง ไม่มีการเปิดกล้องจริง</p><h2>ตั้งค่าการเล่น</h2>
      <p data-testid="video-identity">QA · {sameVideo ? 'ใช้วิดีโอเดิมเมื่อย้ายพรีวิว' : 'วิดีโอถูกเปลี่ยน'}</p>
      <div className="lr-actions">{[['ready','พร้อม'],['calibrating','ตั้งท่า'],['dim','ภาพมืด'],['lost','จับท่าหลุด']].map(([value,name]) => <button key={value} className="secondary" aria-pressed={state === value} onClick={() => { setState(value); if (value === 'lost' || value === 'dim') setProblem(true); }}>{name}</button>)}</div>
      <section className="lr-camera-settings"><div ref={setupHost} /><CameraTuningControls tuning={tuning} onChange={setTuning} onRecenter={() => setState('calibrating')} onOpen={() => setState('ready')} on ready={ready} status={status} /></section>
    </section>
    {problem && <CameraProblemDialog reason="QA · จำลองว่าจับท่าหลุด ไม่มีการเปิดกล้องจริง" status={status} ready={ready} on lighting={state === 'dim' ? 'dim' : 'balanced'} previewHost={problemHost} calibrationProgress={output.calibrationProgress} recovering onContinue={() => setProblem(false)} onRestart={() => setState('ready')} onRecenter={() => setState('calibrating')} onManual={() => { setState('ready'); setProblem(false); }} onExit={() => setProblem(false)} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
