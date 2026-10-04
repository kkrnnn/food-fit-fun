# Camera calibration / upper-target / performance verification

2026-10-04 · branch `codex/camera-calibration-performance` · verified locally; user authorized commit, push and Vercel production release.

## Delivered behavior

- Opening/restarting the camera deliberately opens one large setup dialog. It walks through center, left, right, return center and one upper-target touch with green completion states. The first valid target-reaching frame completes setup immediately; there is no hold, lowering requirement, repeat or 0/2 counter in this step. Gameplay retains its lowering/rearm rule.
- Comfortable left/right positions establish asymmetric lane boundaries. The mapper uses the same mirrored torso coordinate as the overlay, hysteresis and time-based smoothing. A direct left-to-right motion can select right without requiring a dwell in center.
- **Latest user steering:** jump uses nose landmark 0 as a head point crossing the fixed upper target. Slow upward motion and head-only crossings are accepted; shoulder/hip rises need not coincide. Standing normally leaves the head below the target, including near the top edge. Holding above it never moves the target or repeats a command; lowering below it rearms gameplay. Missing/low-confidence heads produce no command and trigger gameplay recovery guidance. This is a head-movement game command; it does not verify an airborne physical jump.
- Setup tests never call the game jump/lane handlers. A separate hand lower/raise cycle confirms OK or starts the round. Camera errors during explicit setup stay inside setup; spontaneous problem dialogs remain scoped to active gameplay/recovery.
- Recovery keeps the validated lane range, recalibrates center and rebases the upper target. Opening the camera afresh resets the full setup.
- The latest tuning raises the normal head target from 7.5% to 15% of standing torso height above the resting head (twice the earlier gap). Setup and normal-sensitivity gameplay share that calibrated line; the target stays inside the image near its top edge.
- The live gameplay preview has a target line and head point, without lane labels or skeleton. The full three-zone overlay is confined to setup, using a torso point for lane steps and the head point for the upper-target step.
- Rendering takes an immediate scene view instead of cloning the entire question/run record each animation frame. UI and persistence still receive detached copies. Idle/menu/paused rendering is capped at 10 FPS, while gesture processing remains active.
- Sustained slow visible camera gameplay can reduce graphics within the user's selected quality ceiling, with delayed restoration. At low quality, sustained frames over 38 ms select a 30 FPS rendering cap. The game clock and gameplay rules continue using elapsed time.

## Regression validation

`npm test`: **35 files / 213 tests passed**. Includes the existing camera, input, kcal/exercise, quiz, tutorial and persistence suites; new cases cover immediate first-touch/head-only calibration, visible fixed targets near the top edge, head-confidence and shoulder-only rejection, asymmetric/direct lane transitions, recovery rebasing, crouch recovery, slow target touches, long upper holds, pose gaps, snapshot isolation and adaptive quality hysteresis.

`npm run build`: passed (existing Vite bundle-size warning remains). `git diff --check`: passed.

The original crouch-to-standing bug was reproduced by `npm test -- src/game/camera/JumpGesture.test.ts` before the fix: it incorrectly emitted a jump. The upper-target requirement subsequently changed the slow-rise behavior deliberately; slow target touches are now a supported action.

## Browser checks

Actual calibration UI and state machine exercised via labelled synthetic poses in `camera-calibration-preview.html`: incomplete setup disables OK; each successful zone turns green; one raised pose frame enables OK immediately, without lowering; missing body disables readiness; retry and camera-error actions are available. This fixture does not open a camera or write profiles/results.

A 390 × 844 iframe in `camera-calibration-mobile.html` provides a real narrow CSS viewport for responsive QA. The in-app browser viewport override did not change the fixture viewport, so it was reset rather than reported as a successful mobile test.

Final desktop and narrow-viewport screenshots were refreshed after the last CSS changes. The narrow modal measured 357 px client width and scroll width (no horizontal overflow); the sticky OK remained visible at the bottom. The real application menu and settings opened without a spontaneous camera-problem dialog or captured runtime errors.

Screenshots are simulated UI, not evidence of live detector accuracy.

## Performance measurements and limits

Deterministic actual Three.js scene fixture: seed 42, medium quality, camera scene framing, 12 seconds, warmup 2 seconds, **no live camera inference**.

- Initial sample: frame median 16.7 ms, p95 17.0 ms; work p95 5.2 ms; zero sampled frames above 50 ms.
- Later sample: frame median 16.7 ms, p95 17.6 ms; work p95 5.2 ms; zero sampled frames above 50 ms. Browser window sizing changed during the session, so these are descriptive samples, not an improvement claim.
- Same-page microbenchmark, 1,000 calls: detached snapshot copying 33.6 ms vs immediate scene view 0.1 ms. This illustrates removal of copying work; it is not a measurement of physical gesture latency or an overall FPS gain.

The no-camera fixture did not reproduce the reported stutter. No speculative mesh pooling, model/delegate changes, or inference-rate increases were applied. Worker/fallback processing remains unchanged. Adaptive quality and idle throttling are intended to reduce load when the real camera competes with rendering.

## Remaining physical validation

Real camera retest is required for different distances/lighting, comfortable zone reach, ten target touches and lane selections, command latency, and frame pacing while inference is running. Automated/synthetic tests do not establish 9/10 accuracy, 200 ms response time, 60 FPS with a live camera, or actual standing-distance legibility. Production delivery evidence will be recorded separately below after deployment completes.
