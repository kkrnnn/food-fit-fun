import { describe, expect, it } from 'vitest';
import { PoseMapper, type PoseLandmark } from './PoseMapper';

function pose(centerX = 0.5, raisedHand: 'none' | 'left' | 'right' = 'none', feetVisible = false): PoseLandmark[] {
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  landmarks[11] = { x: centerX - 0.1, y: 0.5, visibility: 1 };
  landmarks[12] = { x: centerX + 0.1, y: 0.5, visibility: 1 };
  landmarks[15] = { x: centerX - 0.1, y: raisedHand === 'left' ? 0.2 : 0.8, visibility: 1 };
  landmarks[16] = { x: centerX + 0.1, y: raisedHand === 'right' ? 0.2 : 0.8, visibility: 1 };
  landmarks[23] = { x: centerX - 0.075, y: 0.7, visibility: 1 };
  landmarks[24] = { x: centerX + 0.075, y: 0.7, visibility: 1 };
  landmarks[27] = { x: centerX - 0.07, y: 0.95, visibility: feetVisible ? 1 : 0 };
  landmarks[28] = { x: centerX + 0.07, y: 0.95, visibility: feetVisible ? 1 : 0 };
  return landmarks;
}

function calibratedMapper(): PoseMapper {
  const mapper = new PoseMapper();
  for (const time of [0, 500, 1000, 1500]) mapper.ingest(pose(), time);
  expect(mapper.ingest(pose(), 1550).calibrated).toBe(true);
  return mapper;
}

describe('camera gestures', () => {
  it('calibrates and chooses lanes without seeing the feet', () => {
    const mapper = calibratedMapper();
    const left = [1600, 1720, 1840, 1960].map(time => mapper.ingest(pose(0.66), time));
    expect(left.filter(output => output.laneChanged)).toHaveLength(1);
    expect(left[left.length - 1]).toMatchObject({ lane: 0, laneChanged: false });
    const center = [2080, 2200, 2320, 2440].map(time => mapper.ingest(pose(0.5), time));
    expect(center.filter(output => output.laneChanged)).toHaveLength(1);
    expect(center[center.length - 1]).toMatchObject({ lane: 1, laneChanged: false });
  });

  it('emits one command per one-hand raise and lower cycle', () => {
    const mapper = calibratedMapper();
    expect(mapper.ingest(pose(0.5, 'left'), 1600).jump).toBe(false);
    expect(mapper.ingest(pose(0.5, 'left'), 1720).jump).toBe(true);
    expect(mapper.ingest(pose(0.5, 'left'), 1840).jump).toBe(false);
    expect(mapper.ingest(pose(), 1900).jump).toBe(false);
    expect(mapper.ingest(pose(), 2020).jump).toBe(false);
    expect(mapper.ingest(pose(0.5, 'right'), 2100).jump).toBe(false);
    expect(mapper.ingest(pose(0.5, 'right'), 2220).jump).toBe(true);
  });

  it('ignores stale frames and reports tracking loss when inference stops', () => {
    const mapper = calibratedMapper();
    expect(mapper.ingest(pose(0.66), 1600, 1900).laneChanged).toBe(false);
    expect(mapper.tick(1849).trackingLost).toBe(false);
    expect(mapper.tick(1850).trackingLost).toBe(true);
    expect(mapper.ingest(pose(), 1900).trackingValid).toBe(true);
  });
});
