// Actual setup state machine and UI, with labelled synthetic poses only. No camera/data storage.
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CameraCalibration } from '../../src/game/camera/CameraCalibration';
import { PoseMapper, type PoseLandmark } from '../../src/game/camera/PoseMapper';
import { CameraCalibrationDialog, CameraPreview } from '../../src/features/learning/CameraSetup';
import '../../src/features/learning/LearningGame.css';
function Preview() {
  const calibration = useRef(new CameraCalibration()), mapper = useRef(new PoseMapper()), time = useRef(0);
  const previewHost = useRef<HTMLDivElement>(null), emptyHost = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(calibration.current.view), [confirmed, setConfirmed] = useState(false), [status,setStatus]=useState('ภาพจำลอง · ไม่มีการเปิดกล้อง'), [on,setOn]=useState(true);
  const feed = (x=.5,rise=0,frames=1,headRise=rise) => {
    for(let i=0;i<frames;i++) {
      const p: PoseLandmark[] = Array.from({length:33},()=>({x:1-x,y:.6,visibility:1}));
      p[0].y=.2-headRise;
      p[11]={x:1-x-.1,y:.4-rise};p[12]={x:1-x+.1,y:.4-rise};p[23]={x:1-x-.08,y:.7-rise};p[24]={x:1-x+.08,y:.7-rise};
      const output=mapper.current.ingest(p,time.current);calibration.current.ingest(p,output,time.current);time.current+=100;
    }
    setView(calibration.current.view);
  };
  const reset = () => {calibration.current.reset();mapper.current.reset();time.current=0;setView(calibration.current.view);setConfirmed(false);setOn(true);setStatus('ภาพจำลอง · ไม่มีการเปิดกล้อง');};
  return <main className="lr-game lr-camera-mode">
    <CameraPreview placement="calibration" calibrationHost={previewHost} setupHost={emptyHost} problemHost={emptyHost} floatingHost={emptyHost} on={on} status={status} output={null} jumped={view.jumpPulse} calibration={view} compact />
    {confirmed ? <p>ยืนยันสำเร็จ · gesture ระหว่างตั้งค่าไม่ได้เริ่มเกม</p> : <CameraCalibrationDialog view={view} previewHost={previewHost} on={on} status={status} lighting={null} ready={view.stage==='ready' && view.valid} holdProgress={0} onConfirm={()=>setConfirmed(true)} onReset={reset} onRetryJump={()=>{calibration.current.retryJump();setView(calibration.current.view);}} onRestart={reset} onManual={()=>{setConfirmed(true);setStatus('เลือกโหมดปุ่มแล้ว');}} onCancel={()=>setConfirmed(true)} />}
    <div className="qa-tools" aria-label="เครื่องมือจำลองท่าสำหรับ QA"><button onClick={()=>feed(.5,0,18)}>จำลองกลาง</button><button onClick={()=>feed(.34,0,7)}>จำลองซ้าย</button><button onClick={()=>feed(.65,0,7)}>จำลองขวา</button><button onClick={()=>feed(.5,0,7)}>กลับกลาง</button><button onClick={()=>feed(.5,0,1,.05)}>จำลองกระโดด</button><button onClick={()=>{time.current+=500;calibration.current.ingest(null,mapper.current.tick(time.current),time.current);setView(calibration.current.view);setStatus('ให้เห็นไหล่ถึงเอว');}}>จำลองท่าหลุด</button><button onClick={()=>{setOn(false);setStatus('ไม่อนุญาตกล้อง · เปิดใหม่หรือใช้ปุ่มแทน');}}>จำลองกล้องผิดพลาด</button><button onClick={reset}>เริ่มใหม่</button></div>
  </main>;
}
const root=createRoot(document.getElementById('root')!);root.render(<Preview/>);import.meta.hot?.dispose(()=>root.unmount());
