import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseLandmark } from './PoseMapper';
import { imageLighting, type Lighting } from './FrameProcessing';

type Incoming =
  | { type: 'init'; wasmUrl: string; modelUrl: string }
  | { type: 'frame'; image: ImageBitmap; timestampMs: number }
  | { type: 'dispose' };

type Outgoing =
  | { type: 'ready' }
  | { type: 'pose'; landmarks: PoseLandmark[] | null; timestampMs: number; lighting: Lighting }
  | { type: 'error'; message: string };

let landmarker: PoseLandmarker | null = null;
let disposed = false;
const sample = new OffscreenCanvas(32, 24);
const sampleContext = sample.getContext('2d', { willReadFrequently: true });
let lighting: Lighting = 'balanced', lastSample = -Infinity;

function send(message: Outgoing): void {
  self.postMessage(message);
}

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const message = event.data;
  if (message.type === 'dispose') {
    disposed = true;
    landmarker?.close();
    landmarker = null;
    return;
  }

  if (message.type === 'init') {
    try {
      const wasm = await FilesetResolver.forVisionTasks(message.wasmUrl, true);
      const task = await PoseLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: message.modelUrl, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false
      });
      if (disposed) {
        task.close();
        return;
      }
      landmarker = task;
      send({ type: 'ready' });
    } catch (error) {
      if (!disposed) send({ type: 'error', message: String(error) });
    }
    return;
  }

  const { image, timestampMs } = message;
  try {
    if (!disposed && landmarker) {
      const result = landmarker.detectForVideo(image, timestampMs);
      const firstPose = result.landmarks[0];
      if (sampleContext && timestampMs - lastSample >= 500) {
        sampleContext.drawImage(image, 0, 0, 32, 24);
        lighting = imageLighting(sampleContext.getImageData(0, 0, 32, 24).data);
        lastSample = timestampMs;
      }
      send({
        type: 'pose',
        landmarks: firstPose?.map(({ x, y, visibility }) => ({ x, y, visibility })) ?? null,
        timestampMs, lighting
      });
    }
  } catch (error) {
    if (!disposed) send({ type: 'error', message: String(error) });
  } finally {
    image.close();
  }
};
