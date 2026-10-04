import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CameraPreviewContent, CameraTuningControls, CameraProblemDialog } from './CameraSetup';
import { PoseMapper, type PoseLandmark } from '../../game/camera/PoseMapper';
it('does not report a detected lane while off, and gives a real calibration progress value', () => {
  const off = renderToStaticMarkup(<CameraPreviewContent on={false} status="กล้องยังไม่เปิด" output={null} jumped={false} />);
  expect(off).toContain('เปิดกล้องเพื่อทดลองขยับ'); expect(off).not.toContain('เลนที่กล้องตรวจพบ');
  const mapper = new PoseMapper();
  const points: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: .5, y: .7, visibility: 1 }));
  points[11] = { x: .4, y: .4 }; points[12] = { x: .6, y: .4 };
  mapper.ingest(points, 0);
  const markup = renderToStaticMarkup(<CameraPreviewContent on status="ยืนนิ่งตรงกลาง" output={mapper.ingest(points, 750)} jumped={false} />);
  expect(markup).toContain('value="0.5"'); expect(markup).not.toContain('<svg'); expect(markup).not.toContain('เลนที่กล้องตรวจพบ');
});
it('keeps the playing camera image free of narration and renders problem actions in a dialog', () => {
  const preview = renderToStaticMarkup(<CameraPreviewContent compact on status="กล้องพร้อมใช้งาน" output={null} jumped />);
  expect(preview).not.toContain('lr-camera-readout'); expect(preview).not.toContain('<svg'); expect(preview).not.toContain('lr-camera-jump');
  const noop = () => {};
  const dialog = renderToStaticMarkup(<CameraProblemDialog reason="จับท่าหลุด" status="ยืนนิ่งตรงกลาง" ready={false} on lighting="dim" previewHost={{ current: null }} recovering onContinue={noop} onRestart={noop} onRecenter={noop} onManual={noop} onExit={noop} />);
  expect(dialog).toContain('aria-modal="true"'); expect(dialog).toContain('ความคืบหน้ายังอยู่'); expect(dialog).toContain('เพิ่มแสงด้านหน้าตัวคุณ');
  expect(dialog).toContain('disabled="">พร้อมแล้ว · เล่นต่อ'); expect(dialog).toContain('ใช้ปุ่ม / ปัดจอแทน');
  const readyDialog = renderToStaticMarkup(<CameraProblemDialog reason="จับท่าหลุด" status="กล้องพร้อมใช้งาน" ready on lighting={null} previewHost={{ current: null }} recovering holdProgress={.5} onContinue={noop} onRestart={noop} onRecenter={noop} onManual={noop} onExit={noop} />);
  expect(readyDialog).toContain('ยกมือเหนือไหล่ค้าง 1.5 วินาทีเพื่อ OK'); expect(readyDialog).toContain('aria-label="ยกมือเพื่อ OK" max="1" value="0.5"');
  expect(readyDialog).not.toContain('disabled="">พร้อมแล้ว · เล่นต่อ');
});
it('names the selected sensitivity choices and disables recenter until the camera is on', () => {
  const markup = renderToStaticMarkup(<CameraTuningControls tuning={{ lane: 'gentle', jump: 'steady' }} on={false} ready={false} status="กล้องยังไม่เปิด" onChange={() => {}} onRecenter={() => {}} onOpen={() => {}} />);
  expect(markup).toContain('aria-pressed="true">ขยับน้อย'); expect(markup).toContain('aria-pressed="true">ลดการติดผิด');
  expect(markup).toContain('disabled="">ตั้งท่ากลางใหม่');
});
