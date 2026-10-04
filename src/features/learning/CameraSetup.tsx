import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PoseOutput } from '../../game/camera/PoseMapper';
import type { Lighting } from '../../game/camera/FrameProcessing';
import { DEFAULT_CAMERA_TUNING, type CameraTuning, type Sensitivity } from '../../game/camera/CameraTuning';

export interface CameraPreviewProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
  on: boolean;
  status: string;
  output: PoseOutput | null;
  jumped: boolean;
  compact?: boolean;
}
export function CameraPreviewContent({ videoRef, on, status, output, jumped, compact }: CameraPreviewProps) {
  const [aspect, setAspect] = useState(4 / 3);
  const ready = on && !!output?.calibrated && output.trackingValid && !output.trackingLost;
  return <section className={`lr-camera-view ${ready ? 'ready' : ''}`} aria-label="ภาพและการตอบสนองจากกล้อง">
    <div className="lr-camera-stage" style={{ aspectRatio: aspect }}>
      <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={event => {
        const video = event.currentTarget;
        if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight);
      }} />
      {!on && <div className="lr-camera-empty"><span aria-hidden="true">◎</span><strong>ยืนให้เห็นไหล่ถึงเอว</strong><small>เปิดกล้องเพื่อทดลองขยับ</small></div>}
    </div>
    {!compact && <div className="lr-camera-readout">
      <p>{status}</p>
      {on && !output?.calibrated && <progress aria-label="ตั้งท่ากลาง" max="1" value={output?.calibrationProgress ?? 0} />}
      {jumped && ready && <p className="lr-camera-jump-response" role="status">↑ จับท่ากระโดดได้</p>}
      <small>ภาพประมวลผลในเครื่อง ไม่บันทึกภาพ</small>
    </div>}
  </section>;
}

/** Move one persistent video element; toggling Settings must not reopen the stream. */
export function CameraPreview({ placement, setupHost, problemHost, floatingHost, ...props }: CameraPreviewProps & {
  placement: 'settings' | 'problem' | 'floating'; setupHost: React.RefObject<HTMLDivElement>; problemHost: React.RefObject<HTMLDivElement>; floatingHost: React.RefObject<HTMLDivElement>;
}) {
  const [host] = useState(() => document.createElement('div'));
  useEffect(() => {
    (placement === 'problem' ? problemHost.current : placement === 'settings' ? setupHost.current : floatingHost.current)?.appendChild(host);
    return () => { host.remove(); };
  }, [placement, setupHost, problemHost, floatingHost, host]);
  return createPortal(<CameraPreviewContent {...props} />, host);
}

export const CameraProblemDialog = React.forwardRef<HTMLElement, {
  reason: string; status: string; ready: boolean; on: boolean; lighting: Lighting | null; calibrationProgress?: number; holdProgress?: number;
  previewHost: React.RefObject<HTMLDivElement>; onContinue: () => void; onRestart: () => void; onRecenter: () => void; onManual: () => void; onExit: () => void; recovering: boolean;
}>(function CameraProblemDialog({ reason, status, ready, on, lighting, previewHost, onContinue, onRestart, onRecenter, onManual, onExit, recovering, calibrationProgress = 0, holdProgress = 0 }, ref) {
  return <div className="lr-modal-shade lr-camera-problem-shade"><section ref={ref} className="lr-settings-modal lr-camera-problem" role="dialog" aria-modal="true" aria-labelledby="camera-problem-title" aria-describedby="camera-problem-reason">
    <p className="lr-kicker">{recovering ? 'เกมพักไว้แล้ว · ความคืบหน้ายังอยู่' : 'ตั้งกล้องให้พร้อมก่อนเล่น'}</p>
    <h2 id="camera-problem-title">{ready ? 'กล้องพร้อมแล้ว' : 'กล้องยังจับท่าไม่พร้อม'}</h2><p id="camera-problem-reason">{reason}</p>
    <div className="lr-camera-problem-body"><div ref={previewHost} className="lr-camera-problem-preview" /><div className="lr-camera-problem-controls">
      <p role="status">{status}</p>
      {on && !ready && calibrationProgress < 1 && <progress aria-label="ตั้งท่ากลาง" max="1" value={calibrationProgress} />}
      {lighting === 'dim' && <p className="lr-camera-light">ภาพค่อนข้างมืด · เพิ่มแสงด้านหน้าตัวคุณ</p>}
      {lighting === 'bright' && <p className="lr-camera-light">ภาพสว่างมาก · เลี่ยงแสงจ้าหรือหน้าต่างด้านหลัง</p>}
      {ready && <CameraConfirmGesture progress={holdProgress} />}
      <div className="lr-actions"><button disabled={!ready} onClick={onContinue}>{recovering ? 'พร้อมแล้ว · เล่นต่อ' : 'พร้อมแล้ว · กลับไปเล่น'}</button><button className="secondary" onClick={onRestart}>เปิดกล้องใหม่</button>{on && <button className="secondary" onClick={onRecenter}>ตั้งท่ากลางใหม่</button>}<button className="secondary" onClick={onManual}>ใช้ปุ่ม / ปัดจอแทน</button></div>
      <button className="lr-link" onClick={onExit}>กลับไปเมนู</button>
    </div></div>
  </section></div>;
});

function CameraConfirmGesture({ progress }: { progress: number }) {
  return <div className="lr-camera-confirm-gesture"><p>ลดมือลงก่อน<br /><strong>ยกมือเหนือไหล่ค้าง 1.5 วินาทีเพื่อ OK</strong></p><progress aria-label="ยกมือเพื่อ OK" max="1" value={progress} /></div>;
}

export function CameraTuningControls({ tuning, onChange, onRecenter, onOpen, on, ready, status, holdProgress = 0 }: {
  tuning: CameraTuning; onChange: (next: CameraTuning) => void; onRecenter: () => void; onOpen: () => void; on: boolean; ready: boolean; status: string; holdProgress?: number;
}) {
  const choices: Sensitivity[] = ['gentle', 'normal', 'steady'];
  return <div className="lr-camera-tuning">
    <div className="lr-camera-setup-actions"><button onClick={onOpen}>{on ? 'เปิดกล้องใหม่' : 'เปิดกล้อง'}</button><button className="secondary" disabled={!on} onClick={onRecenter}>ตั้งท่ากลางใหม่</button></div>
    <p className="lr-camera-guidance" role="status">{on ? ready ? 'ลองขยับซ้าย–ขวา แล้วกระโดดเบา ๆ ดูว่าเลนและสัญญาณตอบสนองตรงกับคุณไหม' : status : 'วางกล้องให้นิ่ง หันหน้าเข้าหาแสง แล้วถอยให้เห็นไหล่ถึงเอว'}</p>
    {on && ready && <CameraConfirmGesture progress={holdProgress} />}
    {(['lane', 'jump'] as const).map(kind => <fieldset key={kind}>
      <legend>{kind === 'lane' ? 'ความไวเปลี่ยนเลน' : 'ความไวกระโดด'}</legend>
      <div className="lr-camera-sensitivity">{choices.map((value, index) => <button key={value} type="button" className="secondary" aria-pressed={tuning[kind] === value} onClick={() => onChange({ ...tuning, [kind]: value })}>{(kind === 'lane' ? ['ขยับน้อย', 'ปกติ', 'นิ่งขึ้น'] : ['กระโดดเบา', 'ปกติ', 'ลดการติดผิด'])[index]}</button>)}</div>
      <p>{kind === 'lane' ? 'ขยับน้อย: ไปเลนข้างได้ง่าย · นิ่งขึ้น: ลดการเปลี่ยนเลนจากการโยกเล็กน้อย' : 'กระโดดเบา: ใช้การยกตัวน้อยลง · ลดการติดผิด: ต้องยกตัวชัดขึ้น'}</p>
    </fieldset>)}
    <button className="lr-link" onClick={() => onChange({ ...DEFAULT_CAMERA_TUNING })}>คืนค่าความไวเริ่มต้น</button>
  </div>;
}
