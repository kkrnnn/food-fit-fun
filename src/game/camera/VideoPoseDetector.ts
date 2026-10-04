import type { PoseInput } from './PoseMapper';
import { inferenceSize, imageLighting, type Lighting } from './FrameProcessing';

export interface VideoPoseDetector {
  detect(video: HTMLVideoElement, timestampMs: number): PoseInput;
  close(): void;
  readonly lighting?: Lighting;
}
export type VideoPoseDetectorFactory = (wasmUrl: string, modelUrl: string) => Promise<VideoPoseDetector>;

/** DOM-backed fallback for browsers without worker canvas/bitmap support. Loaded only when needed. */
export const createVideoPoseDetector: VideoPoseDetectorFactory = async (wasmUrl, modelUrl) => {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
  const files = await FilesetResolver.forVisionTasks(wasmUrl);
  const task = await PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
    canvas: document.createElement('canvas'),
    runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5, minTrackingConfidence: .5,
    outputSegmentationMasks: false,
  });
  const frame = document.createElement('canvas');
  const context = frame.getContext('2d');
  const sample = document.createElement('canvas');
  sample.width = 32; sample.height = 24;
  const sampleContext = sample.getContext('2d', { willReadFrequently: true });
  let lighting: Lighting = 'balanced', lastSample = -Infinity;
  return {
    detect(video, timestampMs) {
      const size = inferenceSize(video.videoWidth, video.videoHeight);
      if (frame.width !== size.width || frame.height !== size.height) { frame.width = size.width; frame.height = size.height; }
      context?.drawImage(video, 0, 0, size.width, size.height);
      if (sampleContext && timestampMs - lastSample >= 500) {
        sampleContext.drawImage(video, 0, 0, 32, 24);
        lighting = imageLighting(sampleContext.getImageData(0, 0, 32, 24).data);
        lastSample = timestampMs;
      }
      return task.detectForVideo(context ? frame : video,timestampMs).landmarks[0]?.map(({ x,y,visibility }) => ({ x,y,visibility })) ?? null;
    },
    get lighting() { return lighting; },
    close: () => task.close(),
  };
};
