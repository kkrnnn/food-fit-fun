import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PoseOutput } from '../../game/camera/PoseMapper';
import type { Lighting } from '../../game/camera/FrameProcessing';
import { DEFAULT_CAMERA_TUNING, type CameraTuning, type Sensitivity } from '../../game/camera/CameraTuning';
import type { CalibrationView } from '../../game/camera/CameraCalibration';

export interface CameraPreviewProps {
  videoRef?: React.RefObject<HTMLVideoElement>;
  on: boolean;
  status: string;
  output: PoseOutput | null;
  jumped: boolean;
  compact?: boolean;
  calibration?: CalibrationView;
  jumpTarget?: { x: number; bodyY: number; targetY: number; touched: boolean } | null;
}
export function CameraPreviewContent({ videoRef, on, status, output, jumped, compact, calibration, jumpTarget }: CameraPreviewProps) {
  const [aspect, setAspect] = useState(4 / 3);
  const ready = on && !!output?.calibrated && output.trackingValid && !output.trackingLost;
  return <section className={`lr-camera-view ${ready ? 'ready' : ''}`} aria-label="ภาพและการตอบสนองจากกล้อง">
    <div className="lr-camera-stage" style={{ aspectRatio: aspect }}>
      <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={event => {
        const video = event.currentTarget;
        if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight);
      }} />
      {on && !calibration && jumpTarget && <div className="lr-camera-upper-overlay" aria-label="กรอบบนสำหรับกระโดด">
        <div className={`lr-calibration-upper-target ${jumpTarget.touched ? 'passed' : ''}`} style={{height:`${Math.max(0, Math.min(1,jumpTarget.targetY))*100}%`}} />
        <span className="lr-calibration-position" style={{left:`${jumpTarget.x*100}%`,top:`${jumpTarget.bodyY*100}%`}}>●</span>
      </div>}
      {on && calibration && <div className="lr-calibration-zones" aria-label="โซนทดสอบซ้าย กลาง ขวา" style={{ gridTemplateColumns: `${Math.max(0, calibration.boundaries[0]) * 100}% ${Math.max(0, calibration.boundaries[1] - calibration.boundaries[0]) * 100}% 1fr` }}>
        {(['left', 'center', 'right'] as const).map((zone, i) => <div key={zone} className={`${calibration.completed[zone] ? 'passed' : ''} ${calibration.stage === zone || (zone === 'center' && ['return', 'jump'].includes(calibration.stage)) ? 'target' : ''}`}><span>{calibration.completed[zone] ? '✓ ' : ''}{['ซ้าย', 'กลาง', 'ขวา'][i]}</span></div>)}
        {calibration.jumpLine !== null && <div className={`lr-calibration-upper-target ${calibration.jumpPulse || calibration.completed.jump ? 'passed' : ''}`} style={{ height: `${Math.max(0, Math.min(1, calibration.jumpLine)) * 100}%` }}><span>↑ แตะกรอบนี้</span></div>}
        {calibration.valid && calibration.position !== null && <span className="lr-calibration-position" style={{ left: `${Math.max(0, Math.min(1, calibration.position)) * 100}%`, top: `${(calibration.bodyY ?? .5) * 100}%` }} aria-label={calibration.jumpLine === null ? "ตำแหน่งลำตัว" : "ตำแหน่งศีรษะ"}>●</span>}
      </div>}
      {!on && <div className="lr-camera-empty"><span aria-hidden="true">◎</span><strong>ยืนให้เห็นศีรษะถึงเอว</strong><small>เปิดกล้องเพื่อทดลองขยับ</small></div>}
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
export function CameraPreview({ placement, setupHost, problemHost, floatingHost, calibrationHost, ...props }: CameraPreviewProps & {
  placement: 'settings' | 'problem' | 'floating' | 'calibration'; setupHost: React.RefObject<HTMLDivElement>; problemHost: React.RefObject<HTMLDivElement>; floatingHost: React.RefObject<HTMLDivElement>; calibrationHost?: React.RefObject<HTMLDivElement>;
}) {
  const [host] = useState(() => document.createElement('div'));
  useEffect(() => {
    (placement === 'calibration' ? calibrationHost?.current : placement === 'problem' ? problemHost.current : placement === 'settings' ? setupHost.current : floatingHost.current)?.appendChild(host);
    return () => { host.remove(); };
  }, [placement, setupHost, problemHost, floatingHost, calibrationHost, host]);
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

const CALIBRATION_COPY = {
  center: ['ยืนตรงกลางให้นิ่ง', 'ให้เห็นศีรษะถึงเอว เพื่อจำท่ายืนของคุณ'],
  left: ['ขยับไปช่องซ้าย', 'ขยับในระยะที่สบาย แล้วหยุดนิ่งสักครู่'],
  right: ['ขยับไปช่องขวา', 'ขยับไปอีกด้าน แล้วหยุดนิ่งสักครู่'],
  return: ['กลับมาตรงกลาง', 'ยืนตรง เตรียมลองแตะกรอบด้านบน'],
  jump: ['ยกตัวแตะกรอบด้านบน', 'ให้จุดศีรษะถึงกรอบด้านบนหนึ่งครั้ง ผ่านแล้วจะขึ้นสีเขียวทันที'],
  ready: ['ตั้งค่าครบแล้ว!', 'กล้องพร้อมรับการขยับของคุณ'],
} as const;
export const CameraCalibrationDialog = React.forwardRef<HTMLElement, {
  view: CalibrationView; previewHost: React.RefObject<HTMLDivElement>; on: boolean; status: string; lighting: Lighting | null; ready: boolean; holdProgress: number;
  onConfirm: () => void; onReset: () => void; onRetryJump: () => void; onRestart: () => void; onManual: () => void; onCancel: () => void;
}>(function CameraCalibrationDialog({ view, previewHost, on, status, lighting, ready, holdProgress, onConfirm, onReset, onRetryJump, onRestart, onManual, onCancel }, ref) {
  const [title, instruction] = CALIBRATION_COPY[view.stage];
  return <div className="lr-modal-shade lr-calibration-shade"><section ref={ref} className="lr-settings-modal lr-calibration-modal" role="dialog" aria-modal="true" aria-labelledby="calibration-title">
    <div className="lr-calibration-heading"><p className="lr-kicker">ตั้งกล้องให้เข้ากับคุณ</p><button className="lr-link" onClick={onCancel}>กลับ ✕</button></div>
    <div className="lr-calibration-body"><div ref={previewHost} className="lr-calibration-preview" /><div className="lr-calibration-guide">
      <h2 id="calibration-title">{title}</h2><p>{instruction}</p>
      <div className="lr-calibration-checklist">{(['center', 'left', 'right', 'jump'] as const).map((step, i) => <span key={step} className={view.completed[step] ? 'passed' : ''}>{view.completed[step] ? '✓' : '○'} {['กลาง', 'ซ้าย', 'ขวา', 'กรอบบน'][i]}</span>)}</div>
      {on && !['jump', 'ready'].includes(view.stage) && <progress aria-label="ความคืบหน้าท่าที่กำลังทดสอบ" max="1" value={view.progress} />}
      {(!on || !view.valid) && <p className="lr-calibration-status" role="status">{status}</p>}
      {lighting === 'dim' && <p className="lr-camera-light">เพิ่มแสงด้านหน้าตัวคุณ</p>}
      {lighting === 'bright' && <p className="lr-camera-light">เลี่ยงแสงจ้าหรือหน้าต่างด้านหลัง</p>}
      {ready && <CameraConfirmGesture progress={holdProgress} />}
      <button className="lr-calibration-ok" disabled={!ready} onClick={onConfirm}>พร้อมแล้ว · OK ✓</button>
      <div className="lr-calibration-tools">{on ? <button className="secondary" onClick={onReset}>ตั้งท่าใหม่</button> : <button onClick={onRestart}>เปิดกล้องอีกครั้ง</button>}{['jump', 'ready'].includes(view.stage) && <button className="secondary" onClick={onRetryJump}>ลองกรอบบนใหม่</button>}<button className="secondary" onClick={onManual}>ใช้ปุ่มแทน</button></div>
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
    <p className="lr-camera-guidance" role="status">{on ? ready ? 'ตั้งท่าครบแล้ว · ขยับซ้าย–ขวาเลือกเลน และให้จุดศีรษะแตะกรอบบนเพื่อกระโดด' : status : 'วางกล้องให้นิ่ง หันหน้าเข้าหาแสง แล้วถอยให้เห็นศีรษะถึงเอว'}</p>
    {on && ready && <CameraConfirmGesture progress={holdProgress} />}
    {(['lane', 'jump'] as const).map(kind => <fieldset key={kind}>
      <legend>{kind === 'lane' ? 'ความไวเปลี่ยนเลน' : 'ความไวกระโดด'}</legend>
      <div className="lr-camera-sensitivity">{choices.map((value, index) => <button key={value} type="button" className="secondary" aria-pressed={tuning[kind] === value} onClick={() => onChange({ ...tuning, [kind]: value })}>{(kind === 'lane' ? ['ขยับน้อย', 'ปกติ', 'นิ่งขึ้น'] : ['กระโดดเบา', 'ปกติ', 'ลดการติดผิด'])[index]}</button>)}</div>
      <p>{kind === 'lane' ? 'ขยับน้อย: ไปเลนข้างได้ง่าย · นิ่งขึ้น: ลดการเปลี่ยนเลนจากการโยกเล็กน้อย' : 'กระโดดเบา: ใช้การยกตัวน้อยลง · ลดการติดผิด: ต้องยกตัวชัดขึ้น'}</p>
    </fieldset>)}
    <button className="lr-link" onClick={() => onChange({ ...DEFAULT_CAMERA_TUNING })}>คืนค่าความไวเริ่มต้น</button>
  </div>;
}
