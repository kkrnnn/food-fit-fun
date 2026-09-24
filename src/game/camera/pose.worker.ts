import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseLandmark } from './PoseMapper';

type Incoming =
  | { type: 'init'; wasmUrl: string; modelUrl: string }
  | { type: 'frame'; image: ImageBitmap; timestampMs: number }
  | { type: 'dispose' };

type Outgoing =
  | { type: 'ready' }
  | { type: 'pose'; landmarks: PoseLandmark[] | null; timestampMs: number }
  | { type: 'error'; message: string };

let landmarker: PoseLandmarker | null = null;
let disposed = false;

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
      send({
        type: 'pose',
        landmarks: firstPose?.map(({ x, y, visibility }) => ({ x, y, visibility })) ?? null,
        timestampMs
      });
    }
  } catch (error) {
    if (!disposed) send({ type: 'error', message: String(error) });
  } finally {
    image.close();
  }
};
