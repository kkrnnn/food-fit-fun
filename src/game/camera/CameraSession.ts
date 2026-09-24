import type { PoseInput } from './PoseMapper';

export type CameraSessionPhase = 'off' | 'requesting' | 'loading' | 'active' | 'error';

export interface CameraSessionEvents {
  onPhase: (phase: CameraSessionPhase, message?: string) => void;
  onPose: (landmarks: PoseInput, timestampMs: number) => void;
  onInterrupted: (message: string) => void;
}

type WorkerOutput =
  | { type: 'ready' }
  | { type: 'pose'; landmarks: PoseInput; timestampMs: number }
  | { type: 'error'; message: string };

const FRAME_INTERVAL_MS = 67;

/** Owns all camera and inference resources for one active session. */
export class CameraSession {
  private generation = 0;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private worker: Worker | null = null;
  private rafId: number | null = null;
  private inFlight = false;
  private lastFrameMs = 0;
  private lastVideoTime = -1;
  private phase: CameraSessionPhase = 'off';
  private framesPaused = false;

  constructor(private readonly events: CameraSessionEvents) {}

  get isActive(): boolean {
    return this.phase === 'active';
  }

  async start(video: HTMLVideoElement): Promise<void> {
    this.stop();
    const generation = this.generation;
    this.video = video;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.fail('กล้องต้องเปิดบน localhost หรือ HTTPS');
      return;
    }
    if (!window.Worker || !window.createImageBitmap) {
      this.fail('เบราว์เซอร์นี้ไม่รองรับการประมวลผลกล้อง');
      return;
    }
    this.setPhase('requesting', 'รออนุญาตใช้กล้อง');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', this.handleTrackEnded);
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      if (generation !== this.generation) return;
      this.setPhase('loading', 'กำลังโหลดตัวตรวจท่าทาง');
      const worker = new Worker(new URL('./pose.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
        if (generation !== this.generation) return;
        const message = event.data;
        if (message.type === 'ready') {
          this.setPhase('active');
          this.scheduleFrames(generation);
        } else if (message.type === 'pose') {
          this.inFlight = false;
          this.events.onPose(message.landmarks, message.timestampMs);
        } else {
          this.fail(`โหลดหรือตรวจท่าทางไม่สำเร็จ: ${message.message}`);
        }
      };
      worker.onerror = () => {
        if (generation === this.generation) this.fail('ตัวตรวจท่าทางหยุดทำงาน');
      };
      const assetBase = new URL(import.meta.env.BASE_URL, window.location.origin);
      worker.postMessage({
        type: 'init',
        wasmUrl: new URL('mediapipe/wasm', assetBase).href,
        modelUrl: new URL('mediapipe/pose_landmarker_lite.task', assetBase).href
      });
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(this.describeMediaError(error));
    }
  }

  pauseFrames(): void {
    this.framesPaused = true;
  }

  resumeFrames(): void {
    this.framesPaused = false;
  }

  stop(): void {
    this.generation++;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.framesPaused = false;
    this.inFlight = false;
    this.lastFrameMs = 0;
    this.lastVideoTime = -1;
    this.worker?.postMessage({ type: 'dispose' });
    this.worker?.terminate();
    this.worker = null;
    this.stream?.getVideoTracks()[0]?.removeEventListener('ended', this.handleTrackEnded);
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
    this.setPhase('off');
  }

  private scheduleFrames(generation: number): void {
    const loop = (nowMs: number) => {
      if (generation !== this.generation || this.phase !== 'active') return;
      this.rafId = requestAnimationFrame(loop);
      const video = this.video;
      if (!video || this.framesPaused || document.hidden || this.inFlight || video.readyState < 2) return;
      if (nowMs - this.lastFrameMs < FRAME_INTERVAL_MS || video.currentTime === this.lastVideoTime) return;
      this.lastFrameMs = nowMs;
      this.lastVideoTime = video.currentTime;
      this.inFlight = true;
      void createImageBitmap(video).then(image => {
        if (generation !== this.generation || this.phase !== 'active' || this.framesPaused || document.hidden) {
          image.close();
          this.inFlight = false;
          return;
        }
        this.worker?.postMessage({ type: 'frame', image, timestampMs: nowMs }, [image]);
      }).catch(error => {
        this.inFlight = false;
        if (generation === this.generation) this.fail(`อ่านภาพจากกล้องไม่สำเร็จ: ${String(error)}`);
      });
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private handleTrackEnded = () => {
    this.events.onInterrupted('กล้องถูกถอดหรือหยุดส่งภาพ');
    this.fail('กล้องถูกถอดหรือหยุดส่งภาพ');
  };

  private fail(message: string): void {
    this.stop();
    this.setPhase('error', message);
  }

  private setPhase(phase: CameraSessionPhase, message?: string): void {
    this.phase = phase;
    this.events.onPhase(phase, message);
  }

  private describeMediaError(error: unknown): string {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'ไม่ได้รับอนุญาตให้ใช้กล้อง';
      if (error.name === 'NotFoundError') return 'ไม่พบกล้องบนอุปกรณ์';
      if (error.name === 'NotReadableError') return 'กล้องอาจถูกแอปอื่นใช้งานอยู่';
    }
    return `เปิดกล้องไม่สำเร็จ: ${String(error)}`;
  }
}
