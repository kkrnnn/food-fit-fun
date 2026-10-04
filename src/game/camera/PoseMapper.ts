import { LANE_TUNING, type Sensitivity } from './CameraTuning';
import { torsoSample } from './TorsoPose';
import type { LaneCalibration } from './CameraCalibration';
/** MediaPipe Pose landmark fields used by the game. Coordinates are normalized to the input image. */
export interface PoseLandmark {
  x: number;
  y: number;
  visibility?: number;
  presence?: number;
}

export type Lane = 0 | 1 | 2;
export type PoseInput = readonly PoseLandmark[] | null;

export interface PoseOutput {
  calibrated: boolean;
  /** Current absolute lane. Omitted until calibration or when shoulders are invalid. */
  lane?: Lane;
  /** True only when the desired lane changes. */
  laneChanged: boolean;
  /** One pulse for each raise and lower cycle of either hand. */
  jump: boolean;
  /** At least one wrist is visible enough to recognize a hand raise. */
  handTrackingValid: boolean;
  /** Setup guidance when the upper body or hands are missing or moving during calibration. */
  setupHint?: 'show-upper-body' | 'show-hand' | 'stand-still';
  /** Shoulders in this frame were usable. A clock-only tick always returns false. */
  trackingValid: boolean;
  /** Shoulders have been unusable or absent for at least 300 ms. */
  trackingLost: boolean;
  calibrationProgress: number;
}

export interface PoseMapperOptions {
  /** Set true if landmarks were inferred from an already mirrored image. */
  inputMirrored?: boolean;
  sensitivity?: Sensitivity;
}

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const MIN_CONFIDENCE = 0.6;
const MIN_SHOULDER_WIDTH = 0.025;
const MIN_TORSO_HEIGHT = 0.06;
const CALIBRATION_MS = 1500;
const TRACKING_LOSS_MS = 300;
const MAX_FRAME_AGE_MS = 250;
const LANE_DWELL_MS = 100;
const HAND_RAISE_DWELL_MS = 100;
const HAND_LOWER_DWELL_MS = 100;
const HAND_COOLDOWN_MS = 350;

interface Shoulders {
  x: number;
  width: number;
  left: PoseLandmark;
  right: PoseLandmark;
}

interface Torso {
  hipY: number;
  height: number;
}

type HandSide = 'left' | 'right';

function reliable(point: PoseLandmark | undefined): point is PoseLandmark {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y)
    && (point.visibility ?? 1) >= MIN_CONFIDENCE
    && (point.presence ?? 1) >= MIN_CONFIDENCE;
}

/**
 * Maps torso position to lanes and a raised hand to a one-shot command.
 * The calibration and action only need shoulders, hips and wrists, so players
 * can stand farther from the webcam without keeping their feet in frame.
 *
 * Call ingest for every result, including null when the model finds no pose.
 * Call tick from the UI/render clock while no results arrive, so camera stalls
 * can trigger tracking loss. Timestamps must be monotonic milliseconds.
 */
export class PoseMapper {
  private readonly inputMirrored: boolean;
  private sensitivity: Sensitivity;
  private lastFrameMs = -Infinity;
  private lastGoodMs = -Infinity;
  private lossHandled = false;
  private calibrationStartMs: number | null = null;
  private calibrationCenterSum = 0;
  private calibrationWidthSum = 0;
  private calibrationCount = 0;
  private calibrationAnchor = 0;
  private calibrationHipAnchor = 0;
  private neutralX: number | null = null;
  private neutralWidth = 0;
  private laneCalibration: LaneCalibration | null = null;
  private setupHint: PoseOutput['setupHint'];
  private handTrackingValid = false;
  private smoothedOffset = 0;
  private smoothTimeMs: number | null = null;
  private lane: Lane = 1;
  private candidateLane: Lane | null = null;
  private candidateSinceMs = 0;
  private handArmed = false;
  private activeHand: HandSide | null = null;
  private handMustLower: HandSide | 'both' | null = null;
  private handCandidate: HandSide | null = null;
  private handCandidateSinceMs = 0;
  private handLoweredSinceMs: number | null = null;
  private lastHandPulseMs = -Infinity;

  constructor(options: PoseMapperOptions = {}) {
    this.inputMirrored = options.inputMirrored ?? false;
    this.sensitivity = options.sensitivity ?? 'normal';
  }

  setSensitivity(value: Sensitivity): void {
    this.sensitivity = value;
    this.resetGesture();
  }

  setLaneCalibration(value: LaneCalibration | null): void {
    this.laneCalibration = value;
    if (value) { this.neutralX = value.center; this.neutralWidth = value.width; }
    this.lane = 1; this.resetGesture();
  }

  get laneBoundaries(): [number, number] {
    const center = this.neutralX ?? .5, width = this.neutralWidth || .2;
    const factor = LANE_TUNING[this.sensitivity].enter / LANE_TUNING.normal.enter;
    return this.laneCalibration
      ? [center - (center - this.laneCalibration.left) / 2 * factor, center + (this.laneCalibration.right - center) / 2 * factor]
      : [center - width * LANE_TUNING[this.sensitivity].enter, center + width * LANE_TUNING[this.sensitivity].enter];
  }

  reset(): void {
    this.lastFrameMs = -Infinity;
    this.lastGoodMs = -Infinity;
    this.lossHandled = false;
    this.clearCalibration();
    this.neutralX = null;
    this.neutralWidth = 0;
    this.laneCalibration = null;
    this.setupHint = undefined;
    this.handTrackingValid = false;
    this.lane = 1;
    this.lastHandPulseMs = -Infinity;
    this.resetGesture();
  }

  /** Discard pending motion and require a hand-lower cycle before another command. */
  resetGesture(): void {
    this.smoothedOffset = 0;
    this.smoothTimeMs = null;
    this.candidateLane = null;
    if (!this.handArmed) this.handMustLower ??= this.activeHand ?? this.handCandidate ?? 'both';
    else this.handMustLower = null;
    this.activeHand = null;
    this.handCandidate = null;
    this.handLoweredSinceMs = null;
  }

  /** Recenter on a new neutral pose without replacing this mapper/session. */
  recalibrate(): void {
    this.clearCalibration();
    this.neutralX = null;
    this.neutralWidth = 0;
    this.setupHint = undefined;
    this.handTrackingValid = false;
    this.lane = 1;
    this.resetGesture();
  }

  ingest(landmarks: PoseInput, timestampMs: number, nowMs = timestampMs): PoseOutput {
    if (!Number.isFinite(timestampMs) || !Number.isFinite(nowMs)
      || timestampMs <= this.lastFrameMs || timestampMs > nowMs
      || nowMs - timestampMs > MAX_FRAME_AGE_MS) {
      return this.output(nowMs, false);
    }
    this.lastFrameMs = timestampMs;
    const shoulders = this.getShoulders(landmarks);
    const torso = shoulders ? this.getTorso(landmarks, shoulders) : null;
    if (!shoulders || !torso) {
      this.clearCalibration();
      this.candidateLane = null;
      this.handCandidate = null;
      this.handTrackingValid = false;
      this.setupHint = 'show-upper-body';
      return this.output(nowMs, false);
    }
    this.lastGoodMs = timestampMs;
    this.lossHandled = false;
    const hands = this.getHands(landmarks);
    this.handTrackingValid = hands.left !== null || hands.right !== null;

    if (this.neutralX === null) {
      this.observeCalibration(shoulders, torso, timestampMs);
      if (!this.handTrackingValid && this.setupHint !== 'stand-still') this.setupHint = 'show-hand';
      return this.output(nowMs, true);
    }
    this.setupHint = this.handTrackingValid ? undefined : 'show-hand';

    const displayedX = this.screenX(shoulders.x);
    const offset = (displayedX - this.neutralX) / this.neutralWidth;
    const dt = this.smoothTimeMs === null ? 0 : Math.max(0, timestampMs - this.smoothTimeMs);
    const alpha = this.smoothTimeMs === null ? 1 : 1 - Math.exp(-dt / LANE_TUNING[this.sensitivity].smoothingMs);
    this.smoothedOffset += alpha * (offset - this.smoothedOffset);
    this.smoothTimeMs = timestampMs;

    const desired = this.desiredLane(this.smoothedOffset);
    let laneChanged = false;
    if (desired === this.lane) {
      this.candidateLane = null;
    } else if (this.candidateLane !== desired) {
      this.candidateLane = desired;
      this.candidateSinceMs = timestampMs;
    } else if (timestampMs - this.candidateSinceMs >= LANE_DWELL_MS) {
      this.lane = desired;
      this.candidateLane = null;
      laneChanged = true;
    }

    const jump = this.observeHandRaise(shoulders, torso, hands, timestampMs);
    return { ...this.output(nowMs, true), laneChanged, jump };
  }

  tick(nowMs: number): PoseOutput {
    return this.output(nowMs, false);
  }

  private screenX(x: number): number {
    return this.inputMirrored ? x : 1 - x;
  }

  private getShoulders(landmarks: PoseInput): Shoulders | null {
    const left = landmarks?.[LEFT_SHOULDER];
    const right = landmarks?.[RIGHT_SHOULDER];
    if (!reliable(left) || !reliable(right)) return null;
    const width = Math.abs(left.x - right.x);
    if (width < MIN_SHOULDER_WIDTH) return null;
    return { x: torsoSample(landmarks)?.x ?? (left.x + right.x) / 2, width, left, right };
  }

  private getTorso(landmarks: PoseInput, shoulders: Shoulders): Torso | null {
    const leftHip = landmarks?.[LEFT_HIP];
    const rightHip = landmarks?.[RIGHT_HIP];
    if (!reliable(leftHip) || !reliable(rightHip)) return null;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const shoulderY = (shoulders.left.y + shoulders.right.y) / 2;
    const height = hipY - shoulderY;
    if (height < MIN_TORSO_HEIGHT || hipY > 1 || hipY <= shoulderY) return null;
    return { hipY, height };
  }

  private getHands(landmarks: PoseInput): { left: PoseLandmark | null; right: PoseLandmark | null } {
    const left = landmarks?.[LEFT_WRIST];
    const right = landmarks?.[RIGHT_WRIST];
    return {
      left: reliable(left) ? left : null,
      right: reliable(right) ? right : null,
    };
  }

  private observeCalibration(shoulders: Shoulders, torso: Torso, timestampMs: number): void {
    const x = this.screenX(shoulders.x);
    const moving = this.calibrationStartMs !== null
      && (Math.abs(x - this.calibrationAnchor) > shoulders.width * 0.15
        || Math.abs(torso.hipY - this.calibrationHipAnchor) > torso.height * 0.08);
    if (this.calibrationStartMs === null || moving) {
      this.clearCalibration();
      this.calibrationStartMs = timestampMs;
      this.calibrationAnchor = x;
      this.calibrationHipAnchor = torso.hipY;
    }
    this.setupHint = moving ? 'stand-still' : undefined;
    this.calibrationCenterSum += x;
    this.calibrationWidthSum += shoulders.width;
    this.calibrationCount++;
    if (timestampMs - this.calibrationStartMs! >= CALIBRATION_MS) {
      this.neutralX = this.calibrationCenterSum / this.calibrationCount;
      this.neutralWidth = this.calibrationWidthSum / this.calibrationCount;
      if (this.laneCalibration) {
        const old = this.laneCalibration, scale = this.neutralWidth / old.width;
        this.laneCalibration = { center: this.neutralX, width: this.neutralWidth, left: this.neutralX + (old.left - old.center) * scale, right: this.neutralX + (old.right - old.center) * scale };
      }
      this.clearCalibration();
      this.handArmed = true;
      this.handMustLower = null;
      this.setupHint = undefined;
    }
  }

  private clearCalibration(): void {
    this.calibrationStartMs = null;
    this.calibrationCenterSum = 0;
    this.calibrationWidthSum = 0;
    this.calibrationCount = 0;
  }

  private desiredLane(offset: number): Lane {
    const [left, right] = this.laneBoundaries;
    const leftEnter = (left - this.neutralX!) / this.neutralWidth;
    const rightEnter = (right - this.neutralX!) / this.neutralWidth;
    if (offset < leftEnter) return 0;
    if (offset > rightEnter) return 2;
    const hysteresis = LANE_TUNING[this.sensitivity].exit / LANE_TUNING[this.sensitivity].enter;
    if (this.lane === 0 && offset < leftEnter * hysteresis) return 0;
    if (this.lane === 2 && offset > rightEnter * hysteresis) return 2;
    return 1;
  }

  private observeHandRaise(
    shoulders: Shoulders,
    torso: Torso,
    hands: { left: PoseLandmark | null; right: PoseLandmark | null },
    timestampMs: number,
  ): boolean {
    const handIsRaised = (side: HandSide) => {
      const hand = hands[side];
      const shoulder = side === 'left' ? shoulders.left : shoulders.right;
      return hand !== null && hand.y < shoulder.y - torso.height * 0.12;
    };

    if (!this.handArmed && this.activeHand === null) {
      const leftIsLowered = hands.left !== null && hands.left.y >= shoulders.left.y - torso.height * 0.02;
      const rightIsLowered = hands.right !== null && hands.right.y >= shoulders.right.y - torso.height * 0.02;
      const released = this.handMustLower === 'both'
        ? leftIsLowered && rightIsLowered
        : this.handMustLower === 'left' ? leftIsLowered
          : this.handMustLower === 'right' ? rightIsLowered
            : false;
      if (released) {
        this.handArmed = true;
        this.handMustLower = null;
      }
      return false;
    }

    if (this.activeHand !== null) {
      const hand = hands[this.activeHand];
      const shoulder = this.activeHand === 'left' ? shoulders.left : shoulders.right;
      if (!hand) {
        this.handLoweredSinceMs = null;
        return false;
      }
      if (hand.y >= shoulder.y - torso.height * 0.02) {
        this.handLoweredSinceMs ??= timestampMs;
        if (timestampMs - this.handLoweredSinceMs >= HAND_LOWER_DWELL_MS) {
          this.activeHand = null;
          this.handLoweredSinceMs = null;
          this.handArmed = true;
          this.handMustLower = null;
        }
      } else {
        this.handLoweredSinceMs = null;
      }
      return false;
    }

    const raisedSide: HandSide | null = handIsRaised('left') ? 'left' : handIsRaised('right') ? 'right' : null;
    if (!raisedSide) {
      this.handCandidate = null;
      return false;
    }
    if (this.handCandidate !== raisedSide) {
      this.handCandidate = raisedSide;
      this.handCandidateSinceMs = timestampMs;
      return false;
    }
    if (timestampMs - this.handCandidateSinceMs < HAND_RAISE_DWELL_MS) return false;
    if (!this.handArmed || timestampMs - this.lastHandPulseMs < HAND_COOLDOWN_MS) return false;
    this.activeHand = raisedSide;
    this.handCandidate = null;
    this.handArmed = false;
    this.lastHandPulseMs = timestampMs;
    return true;
  }

  private output(nowMs: number, trackingValid: boolean): PoseOutput {
    const trackingLost = this.lastGoodMs !== -Infinity
      && Number.isFinite(nowMs) && nowMs - this.lastGoodMs >= TRACKING_LOSS_MS;
    if (trackingLost && !this.lossHandled) {
      this.resetGesture();
      this.lossHandled = true;
    }
    return {
      calibrated: this.neutralX !== null,
      lane: trackingValid && this.neutralX !== null ? this.lane : undefined,
      laneChanged: false,
      jump: false,
      handTrackingValid: this.handTrackingValid && trackingValid,
      setupHint: this.setupHint,
      trackingValid,
      trackingLost,
      calibrationProgress: this.neutralX !== null ? 1 : this.calibrationStartMs === null ? 0 : Math.max(0, Math.min(1, (this.lastFrameMs - this.calibrationStartMs) / CALIBRATION_MS)),
    };
  }
}
