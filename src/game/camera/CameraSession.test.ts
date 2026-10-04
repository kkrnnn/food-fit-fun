import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraSession, type CameraSessionPhase } from './CameraSession';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('camera session', () => {
  it('returns a late permission grant after the player cancels camera setup', async () => {
    let grant!: (stream: MediaStream) => void;
    const permission = new Promise<MediaStream>(resolve => { grant = resolve; });
    vi.stubGlobal('window', { isSecureContext: true, Worker: function Worker() {}, createImageBitmap: () => {} });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => permission } });
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    const video = { pause: vi.fn(), srcObject: null } as unknown as HTMLVideoElement;
    const phases: CameraSessionPhase[] = [];
    const session = new CameraSession({
      onPhase: phase => { phases.push(phase); },
      onPose: () => {},
      onInterrupted: () => {}
    });

    const starting = session.start(video);
    expect(phases).toContain('requesting');
    session.stop();
    grant(stream);
    await starting;

    expect(stopTrack).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    expect(session.isActive).toBe(false);
  });

  it('shows an error before requesting a camera in an insecure page', async () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal('window', { isSecureContext: false });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const phases: CameraSessionPhase[] = [];
    const session = new CameraSession({
      onPhase: phase => { phases.push(phase); },
      onPose: () => {},
      onInterrupted: () => {}
    });

    await session.start({ pause: () => {}, srcObject: null } as unknown as HTMLVideoElement);

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(phases[phases.length - 1]).toBe('error');
  });
});

it('keeps camera control available without Worker or createImageBitmap using the video detector', async () => {
  vi.stubGlobal('window', { isSecureContext: true, location: { origin: 'https://game.test' } });
  vi.stubGlobal('document', { hidden: false });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const track = { addEventListener: vi.fn(), removeEventListener: vi.fn(), stop: vi.fn() };
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [track], getVideoTracks: () => [track] }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia }, userAgent: 'iPhone Safari', maxTouchPoints: 5 });
  const close = vi.fn();
  const createDetector = vi.fn(async () => ({ detect: vi.fn(() => null), close }));
  const video = { pause: vi.fn(), play: vi.fn(async () => {}), setAttribute: vi.fn(), srcObject: null, readyState: 2 } as unknown as HTMLVideoElement;
  const session = new CameraSession({ onPhase: vi.fn(), onPose: vi.fn(), onInterrupted: vi.fn() }, createDetector);
  await session.start(video);
  expect(getUserMedia).toHaveBeenCalledOnce();
  expect(createDetector).toHaveBeenCalledOnce();
  expect(session.isActive).toBe(true);
  session.stop();
  expect(close).toHaveBeenCalledOnce();
  expect(track.stop).toHaveBeenCalledOnce();
});

function fallbackFixture() {
  const track = { addEventListener: vi.fn(), removeEventListener: vi.fn(), stop: vi.fn() };
  vi.stubGlobal('window', { isSecureContext: true, location: { origin: 'https://game.test' } });
  vi.stubGlobal('document', { hidden: false });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track], getVideoTracks: () => [track] })) }, userAgent: 'Chrome' });
  const video = { pause: vi.fn(), play: vi.fn(async () => {}), setAttribute: vi.fn(), srcObject: null, readyState: 2, currentTime: 1 } as unknown as HTMLVideoElement;
  const events = { onPhase: vi.fn(), onPose: vi.fn(), onInterrupted: vi.fn() };
  return { track,video,events };
}

it('recovers a worker initialization error without closing the camera stream', async () => {
  const { track,video,events } = fallbackFixture();
  const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null as null | (() => void) };
  const WorkerConstructor = vi.fn(function() { return worker; });
  vi.stubGlobal('Worker', WorkerConstructor);
  Object.assign(window,{ Worker: WorkerConstructor,createImageBitmap: vi.fn(),OffscreenCanvas: vi.fn() });
  const close = vi.fn();
  const createDetector = vi.fn(async () => ({ detect: vi.fn(() => null),close }));
  const session = new CameraSession(events,createDetector);
  await session.start(video);
  worker.onerror?.();
  await vi.waitFor(() => expect(session.isActive).toBe(true));
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(track.stop).not.toHaveBeenCalled();
  expect(createDetector).toHaveBeenCalledOnce();
  session.stop();
});

it('closes a detector that finishes loading after the player cancels', async () => {
  const { video,events } = fallbackFixture();
  const close = vi.fn();
  let finish!: (value: { detect: () => null; close: () => void }) => void;
  const detector = new Promise<{ detect: () => null; close: () => void }>(resolve => { finish = resolve; });
  const session = new CameraSession(events,() => detector);
  const starting = session.start(video);
  await vi.waitFor(() => expect(events.onPhase).toHaveBeenCalledWith('loading','กำลังโหลดตัวตรวจท่าทางสำหรับอุปกรณ์นี้'));
  session.stop();
  finish({ detect: () => null,close });
  await starting;
  expect(close).toHaveBeenCalledOnce();
  expect(session.isActive).toBe(false);
});

it('reads fallback video frames and stops detecting when paused or disposed', async () => {
  const { video,events } = fallbackFixture();
  let frame!: FrameRequestCallback;
  vi.stubGlobal('requestAnimationFrame',vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
  const detect = vi.fn(() => null), close = vi.fn();
  const session = new CameraSession(events,async () => ({ detect,close }));
  await session.start(video);
  frame(200);
  expect(detect).toHaveBeenCalledWith(video,200);
  expect(events.onPose).toHaveBeenCalledWith(null,200);
  session.pauseFrames(); video.currentTime = 2; frame(400);
  expect(detect).toHaveBeenCalledOnce();
  session.resumeFrames(); frame(600);
  expect(detect).toHaveBeenCalledTimes(2);
  session.stop(); frame(800);
  expect(detect).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledOnce();
});

it('switches to fallback if a worker never finishes loading', async () => {
  vi.useFakeTimers();
  const { video,events } = fallbackFixture();
  const worker = { postMessage: vi.fn(),terminate: vi.fn() };
  const WorkerConstructor = vi.fn(function() { return worker; });
  vi.stubGlobal('Worker',WorkerConstructor);
  Object.assign(window,{ Worker: WorkerConstructor,createImageBitmap: vi.fn(),OffscreenCanvas: vi.fn() });
  const createDetector = vi.fn(async () => ({ detect: () => null,close: vi.fn() }));
  const session = new CameraSession(events,createDetector);
  await session.start(video);
  expect(createDetector).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(15000);
  expect(createDetector).toHaveBeenCalledOnce();
  expect(session.isActive).toBe(true);
  session.stop();
});

it('ends an indefinitely stalled fallback with a visible error and releases the camera', async () => {
  vi.useFakeTimers();
  const { video,events,track } = fallbackFixture();
  const close = vi.fn();
  let finish!: (detector: { detect: () => null; close: () => void }) => void;
  const loading = new Promise<{ detect: () => null; close: () => void }>(resolve => { finish = resolve; });
  const session = new CameraSession(events,() => loading);
  const starting = session.start(video);
  await vi.advanceTimersByTimeAsync(30000);
  expect(session.isActive).toBe(false);
  expect(events.onPhase).toHaveBeenCalledWith('error',expect.stringContaining('นานเกินไป'));
  expect(track.stop).toHaveBeenCalledOnce();
  finish({ detect: () => null,close });
  await starting;
  expect(close).toHaveBeenCalledOnce();
});

function workerFixture() {
  const fixture = fallbackFixture();
  Object.assign(fixture.video, { videoWidth: 1280, videoHeight: 720 });
  let nextFrame!: FrameRequestCallback;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { nextFrame = callback; return 1; }));
  const worker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null as ((event: MessageEvent) => void) | null, onerror: null };
  const WorkerConstructor = vi.fn(function() { return worker; });
  const image = { close: vi.fn() };
  const bitmap = vi.fn(async () => image);
  vi.stubGlobal('Worker', WorkerConstructor); vi.stubGlobal('createImageBitmap', bitmap);
  Object.assign(window, { Worker: WorkerConstructor, createImageBitmap: bitmap, OffscreenCanvas: vi.fn() });
  const detector = { detect: vi.fn(() => null), close: vi.fn() };
  const createDetector = vi.fn(async () => detector);
  const session = new CameraSession(fixture.events, createDetector);
  const send = (data: unknown) => worker.onmessage?.({ data } as MessageEvent);
  return { ...fixture, worker, image, bitmap, createDetector, session, send, frame: (time: number) => nextFrame(time) };
}

it('resizes complete worker frames and keeps only one inference in flight', async () => {
  const fixture = workerFixture();
  await fixture.session.start(fixture.video); fixture.send({ type: 'ready' });
  fixture.frame(200); await Promise.resolve();
  expect(fixture.bitmap).toHaveBeenCalledWith(fixture.video, { resizeWidth: 480, resizeHeight: 270, resizeQuality: 'medium' });
  fixture.video.currentTime = 2; fixture.frame(300);
  expect(fixture.bitmap).toHaveBeenCalledOnce();
  fixture.session.stop();
});

it('drops stale or paused worker results before they can trigger a game command', async () => {
  const fixture = workerFixture();
  vi.spyOn(performance, 'now').mockReturnValue(600);
  await fixture.session.start(fixture.video); fixture.send({ type: 'ready' });
  fixture.send({ type: 'pose', timestampMs: 200, landmarks: [] });
  expect(fixture.events.onPose).not.toHaveBeenCalled();
  fixture.session.pauseFrames();
  fixture.send({ type: 'pose', timestampMs: 600, landmarks: [] });
  expect(fixture.events.onPose).not.toHaveBeenCalled();
  fixture.session.resumeFrames();
  fixture.send({ type: 'pose', timestampMs: 600, landmarks: [] });
  expect(fixture.events.onPose).toHaveBeenCalledExactlyOnceWith([], 600);
  fixture.session.stop();
});

it('recovers an in-flight worker stall while keeping the same camera stream', async () => {
  const fixture = workerFixture();
  await fixture.session.start(fixture.video); fixture.send({ type: 'ready' });
  fixture.frame(200); await Promise.resolve();
  fixture.video.currentTime = 2; fixture.frame(1801);
  await vi.waitFor(() => expect(fixture.session.isActive).toBe(true));
  expect(fixture.createDetector).toHaveBeenCalledOnce();
  expect(fixture.worker.terminate).toHaveBeenCalledOnce();
  expect(fixture.track.stop).not.toHaveBeenCalled();
  fixture.session.stop();
});

it('closes a prepared bitmap if the player cancels before it is sent', async () => {
  const fixture = workerFixture();
  await fixture.session.start(fixture.video); fixture.send({ type: 'ready' });
  fixture.frame(200); fixture.session.stop(); await Promise.resolve();
  expect(fixture.image.close).toHaveBeenCalledOnce();
  expect(fixture.worker.postMessage.mock.calls.some(([message]) => message.type === 'frame')).toBe(false);
});
