import type { PoseInput } from './PoseMapper';

export interface VideoPoseDetector {
  detect(video: HTMLVideoElement, timestampMs: number): PoseInput;
  close(): void;
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
  return {
    detect(video, timestampMs) {
      return task.detectForVideo(video,timestampMs).landmarks[0]?.map(({ x,y,visibility }) => ({ x,y,visibility })) ?? null;
    },
    close: () => task.close(),
  };
};
