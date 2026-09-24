import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraSession, type CameraSessionPhase } from './CameraSession';

afterEach(() => vi.unstubAllGlobals());

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
