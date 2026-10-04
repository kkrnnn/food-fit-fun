# Camera tuning verification

2026-10-04 · master · validated before the requested commit, push and Vercel production deploy.

## Automated checks

- `npm test -- --maxWorkers=2 --testTimeout=30000`: 194 tests passed across 33 files.
- `npm run build`: passed TypeScript and Vite production build. Existing large-bundle warning remains non-failing.
- `git diff --check`: passed.
- Coverage includes full-frame proportional resizing and light sampling, sensitivity/noise and gesture rearming, worker stall fallback and cleanup, clean preview/dialog controls, and neutral-hand rearming after an OK confirmation.

## Browser checks

- Actual game Settings: clean camera-off preview, selected normal defaults, accessible tuning controls, restore defaults and reload persistence.
- Simulated pose fixture: ready, calibration, lost tracking and lighting guidance states; no skeleton or left/center/right labels on the video. Problem modal enables continue only after readiness.
- Raising a hand is explained with a 1.5-second hold progress bar in ready Settings and the ready problem modal. Confirmation dispatch and neutral-hand reset were checked in code and gesture tests; no physical gesture was performed.
- Returning from the problem modal retains the same video element. One video is present throughout the preview move.
- Narrow 390 × 844 CSS viewport: controls stack, dialog stays within the viewport, document width remains 390 px. Temporary viewport override was reset.

Evidence: `camera-settings-desktop.jpg` is the actual app with camera off. `camera-settings-mobile.jpg`, `camera-ready-simulated.jpg`, `camera-problem-ready-simulated.jpg` and `camera-problem-mobile-simulated.jpg` use the labelled simulated fixture at `camera-setup-preview.html`; they are UI evidence, not camera accuracy evidence.

## Remaining device check

Real camera recognition, movement comfort and physical hand confirmation still need a device retest. Synthetic landmarks do not establish detector accuracy or a measured latency improvement. Frames are resized and lighting diagnosed locally; no accuracy claim is made from preprocessing alone.

## Standing-distance readability follow-up

- Camera-mode modal headings are 36 px on desktop / 30 px on narrow screens. Instructions are 24–28 px on desktop / 22 px on narrow screens; action buttons are 24 / 22 px. The hand-confirm instruction is emphasized, with a thicker progress bar.
- The camera problem dialog places preview beside instructions on desktop; mobile stacks a small preview above the instructions. The main continue action remains prominent. Secondary actions can scroll within the modal on shorter screens.
- Camera-mode item models scale up to 1.55 at distance, tapering to 1.05 near pickup. At maximum scale their footprint remains within the 3.6-unit lane spacing. Item position, exercise altitude, collection and calorie rules stay in RunSession.
- Camera-mode scene view is raised from 3.8 to 5.4 with a smooth transition. The real renderer exposed a center-lane meal previously hidden by the runner; camera and manual comparison screenshots confirm this at the same item distances.
- Relevant regression checks: 24 tests passed in CameraSetup, CollectibleModels, PickupFollowing and CameraExerciseTiming. Production build and diff check passed after the final renderer change.
- Browser inspection covered desktop and 390 × 844 CSS viewport. Both food and exercise silhouettes were visible across all three lanes. Evidence: `camera-large-text-desktop.jpg`, `camera-large-text-mobile.jpg`, `camera-items-large-desktop.jpg`, `camera-items-large-mobile.jpg`, `camera-items-manual-comparison.jpg`. All are labelled local QA fixtures, without opening a real camera.
- Actual readability from the player's standing distance still needs a device retest.

## Delivery

- Feature commit `b57a80cd62d1ec0c5f676c2edfafd74be3e5c64e` was pushed to `origin/master`.
- Vercel production deployment `dpl_FGesJ8C5dGhYhsyuyhBr86FuqaET` reached `READY` and was aliased to [food-fit-fun.vercel.app](https://food-fit-fun.vercel.app). The authenticated `vercel curl` response served the page with its newly built JS/CSS assets.
- The Vercel upload was built from the local checkout at the feature commit because Git was not connected to the Vercel project for push-triggered deployments.
- Standing-distance readability and physical hand confirmation still need a real-device retest.
