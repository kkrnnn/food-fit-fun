import type { PoseInput } from './PoseMapper';
import { createVideoPoseDetector, type VideoPoseDetector, type VideoPoseDetectorFactory } from './VideoPoseDetector';
import { inferenceSize, type Lighting } from './FrameProcessing';

export type CameraSessionPhase = 'off' | 'requesting' | 'loading' | 'active' | 'error';

export interface CameraSessionEvents {
  onPhase: (phase: CameraSessionPhase, message?: string) => void;
  onPose: (landmarks: PoseInput, timestampMs: number) => void;
  onInterrupted: (message: string) => void;
  onLighting?: (lighting: Lighting) => void;
}

type WorkerOutput =
  | { type: 'ready' }
  | { type: 'pose'; landmarks: PoseInput; timestampMs: number; lighting?: Lighting }
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
  private detector: VideoPoseDetector | null = null;
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;
  private usingFallback = false;
  private wasmUrl = '';
  private modelUrl = '';

  constructor(private readonly events: CameraSessionEvents, private readonly createDetector: VideoPoseDetectorFactory = createVideoPoseDetector) {}

  get isActive(): boolean {
    return this.phase === 'active';
  }

  async start(video: HTMLVideoElement): Promise<void> {
    this.stop();
    const generation = this.generation;
    this.video = video;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.fail(window.isSecureContext ? 'เบราว์เซอร์นี้เปิดกล้องไม่ได้ ลองเปิดลิงก์ใน Safari หรือ Chrome โดยตรง แทนเบราว์เซอร์ใน LINE' : 'กล้องต้องเปิดบน localhost หรือ HTTPS');
      return;
    }
    this.setPhase('requesting', 'รออนุญาตใช้กล้อง');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } }
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', this.handleTrackEnded);
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.srcObject = stream;
      await video.play();
      if (generation !== this.generation) return;
      this.setPhase('loading', 'กำลังโหลดตัวตรวจท่าทาง');
      const assetBase = new URL(import.meta.env.BASE_URL, window.location.origin);
      this.wasmUrl = new URL('mediapipe/wasm', assetBase).href;
      this.modelUrl = new URL('mediapipe/pose_landmarker_lite.task', assetBase).href;
      // MediaPipe worker canvas support varies on iPhone/iPad. Use its DOM canvas path there.
      const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
      if (appleMobile || !window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) {
        await this.startFallback(generation);
        return;
      }
      try {
        const worker = new Worker(new URL('./pose.worker.ts', import.meta.url), { type: 'module' });
        this.worker = worker;
        this.loadingTimer = setTimeout(() => { void this.startFallback(generation); }, 15000);
        worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
          if (generation !== this.generation || this.worker !== worker) return;
          const message = event.data;
          if (message.type === 'ready') {
            this.clearLoadingTimer();
            this.setPhase('active');
            this.scheduleFrames(generation);
          } else if (message.type === 'pose') {
            this.inFlight = false;
            if (this.framesPaused || document.hidden || performance.now() - message.timestampMs > 250) return;
            if (message.lighting) this.events.onLighting?.(message.lighting);
            this.events.onPose(message.landmarks, message.timestampMs);
          } else {
            void this.startFallback(generation);
          }
        };
        worker.onerror = () => {
          if (generation === this.generation && this.worker === worker) void this.startFallback(generation);
        };
        worker.postMessage({ type: 'init', wasmUrl: this.wasmUrl, modelUrl: this.modelUrl });
      } catch {
        await this.startFallback(generation);
      }
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
    this.clearLoadingTimer();
    this.detector?.close();
    this.detector = null;
    this.usingFallback = false;
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
      if (!video || this.framesPaused || document.hidden || video.readyState < 2) return;
      if (this.inFlight) {
        if (nowMs - this.lastFrameMs > 1500) void this.startFallback(generation);
        return;
      }
      if (nowMs - this.lastFrameMs < (this.detector ? 125 : FRAME_INTERVAL_MS) || video.currentTime === this.lastVideoTime) return;
      this.lastFrameMs = nowMs;
      this.lastVideoTime = video.currentTime;
      if (this.detector) {
        try {
          const points = this.detector.detect(video,nowMs);
          if (this.detector.lighting) this.events.onLighting?.(this.detector.lighting);
          this.events.onPose(points,nowMs);
        }
        catch { this.fail('ตรวจท่าทางไม่สำเร็จ ลองเปิดกล้องใหม่ หรือใช้โหมดปัดจอ'); }
        return;
      }
      const worker = this.worker;
      this.inFlight = true;
      const size = inferenceSize(video.videoWidth, video.videoHeight);
      void createImageBitmap(video, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'medium' }).then(image => {
        if (generation !== this.generation || this.worker !== worker || this.phase !== 'active' || this.framesPaused || document.hidden) {
          image.close();
          if (generation === this.generation && this.worker === worker) this.inFlight = false;
          return;
        }
        worker?.postMessage({ type: 'frame', image, timestampMs: nowMs }, [image]);
      }).catch(() => {
        if (generation === this.generation && this.worker === worker) { this.inFlight = false; void this.startFallback(generation); }
      });
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private clearLoadingTimer(): void {
    if (this.loadingTimer !== null) clearTimeout(this.loadingTimer);
    this.loadingTimer = null;
  }

  private async startFallback(generation: number): Promise<void> {
    if (generation !== this.generation || this.usingFallback) return;
    this.usingFallback = true;
    this.clearLoadingTimer();
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.worker?.terminate();
    this.worker = null;
    this.inFlight = false;
    this.setPhase('loading', 'กำลังโหลดตัวตรวจท่าทางสำหรับอุปกรณ์นี้');
    this.loadingTimer = setTimeout(() => {
      if (generation === this.generation) this.fail('โหลดตัวตรวจท่าทางนานเกินไป ตรวจอินเทอร์เน็ตแล้วลองใหม่ หรือใช้โหมดปัดจอ');
    }, 30000);
    try {
      const detector = await this.createDetector(this.wasmUrl,this.modelUrl);
      if (generation !== this.generation) { detector.close(); return; }
      this.clearLoadingTimer();
      this.detector = detector;
      this.setPhase('active');
      this.scheduleFrames(generation);
    } catch {
      if (generation === this.generation) this.fail('เปิดกล้องได้ แต่โหลดตัวตรวจท่าทางไม่สำเร็จ ลองเปิดใน Safari หรือ Chrome โดยตรง หรือใช้โหมดปัดจอ');
    }
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
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'ไม่ได้รับอนุญาตให้ใช้กล้อง ตรวจสิทธิ์กล้องของเว็บไซต์และเบราว์เซอร์ แล้วลองใหม่ หากเปิดผ่าน LINE ให้เปิดใน Safari หรือ Chrome';
      if (error.name === 'NotFoundError') return 'ไม่พบกล้องบนอุปกรณ์';
      if (error.name === 'NotReadableError') return 'กล้องอาจถูกแอปอื่นใช้งานอยู่';
    }
    return `เปิดกล้องไม่สำเร็จ: ${String(error)}`;
  }
}
