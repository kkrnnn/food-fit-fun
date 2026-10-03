# Learning revamp verification — 2026-10-02

- Automated: 36/36 tests across 5 files passed. Includes existing camera mapper, source health examples, continuous course gates, streak/reset, item effects, seeded question deck, fake IndexedDB transactions, per-tab interruption, high-score grouping and export contents.
- Build: TypeScript + Vite passed. Vite reports the existing large application chunk (~847 kB); no build error.
- Browser: localhost Vite dev and production preview. Intro checkbox/modal, Title, Settings/manual mode, profile (whole years, no activity), actual gates/question cards during forward movement, pause/resume, result/review and caregiver panel inspected.
- Early run: Game Over after 3 consecutive wrong; 3 answered / 7 unreached / 0 correct. Unreached explicitly excluded from incorrect.
- Full run: 10 correct / 10 answered, finish at 1100, score 1445, balance distance 73%. Used UI button controls; explicit QA pauses between observation batches. Quiz itself did not pause the simulation.
- Reload retained the synthetic QA profile; caregiver view showed 4 persisted draft runs and 0 real runs. No console errors in inspected dev tab.
- Responsive: desktop 1280×720, narrow 390×844 Title and profile inspected. Intro modal also inspected in narrow app panel. Viewport override reset afterward.
- Browser download event observation timed out in the in-app browser; downloaded file delivery was not confirmed there. Export content/formula escaping verified in automated tests.
- Real camera with a physically moving participant and real reviewed question-bank import remain unverified. Draft demo bank is visibly labelled and excluded from real knowledge analytics.

## Follow-up: faster three-minute course / top answers / BMI / tenth-gate finish

- 38 automated tests passed, adding BMI-based character initialization, item-only fictional BMI changes, and immediate finish at answer ten at 180,000 active milliseconds. Three-consecutive-wrong on question ten still takes priority over finish.
- Speed doubled from 8 to 16 units/sec; distance is 2880 with gates every288. Each answer approach remains 6 seconds. Level version bumped to isolate previous scores.
- Actual browser play reached the tenth answer gate and immediately showed the result: 10 answered, 9 correct, 0 unreached, score1400. QA pauses between batches are excluded from the target duration.
- Synthetic profile changed from 35kg/140cm (BMI17.9) to49kg/140cm (BMI25.0): body proportions changed, starting BMI remained25.0, and fictional BMI responded to items and returned to25.0 at balance0. Real profile measurements were not modified by gameplay.
- Top answer controls have no number/lane-name prefixes. Fixed the inherited pointer-events blocker found during actual clicking; selected answers then updated lane/pressed state. Hover color remains readable.
- Desktop and390×844 quiz screenshots inspected. Portrait camera expands its horizontal view so outer-lane characters stay visible. Viewport override reset.
- Captured the last question with the FINISH label and observed the result directly after crossing its gate. No separate post-quiz segment.

## BMI color and organic runner follow-up
- `npm run test`: 41/41 pass, including high BMI red at zero balance, healthy/low colors, conservative whole-year boundary handling, age/sex reference changes and missing-reference fallback.
- `npm run build`: passes; existing bundle-size advisory remains.
- Browser at port 3000: synthetic male age 10, height 140 cm, weight 49 kg gives initial BMI 25.0 and red high-reference state immediately. After item changes, simulated BMI remains in the red zone; manual lane movement works with the new model.
- Inspected desktop 1280x720 and portrait 390x844: curved runner, attached limbs, red meter, readable top quiz answers. Screenshots: `body-rush-model-bmi.jpg`, `body-rush-model-bmi-mobile.jpg`.
- Camera hardware tracking was not exercised in this follow-up.

## Running pose / shadow / keyboard follow-up
- Corrected knee rotation sign: lower legs fold heels behind the runner, with opposite arm/leg swing. Corrected forearm bend direction and reduced bounce. Joint geometry tests check an entire stride cycle.
- Replaced overlapping directional runner shadow + solid disk with one feathered contact shadow. Character meshes no longer cast the distant silhouette. Removed the headband intersection at the back of the hair.
- Removed HUD arrow controls. Browser keyboard checks: D selects right, A moves from right straight to left, S returns to center; S also updates the selected answer during quiz approach. DOM confirms no `.lr-lane-controls` elements.
- `npm run test`: 44/44 pass. `npm run build`: passes, existing bundle-size advisory remains. Screenshot: `body-rush-run-pose.jpg`.

## Vercel production deployment
- Project: `dream-league1/body-rush`, production: https://body-rush.vercel.app
- Deployment: `dpl_8nKywokyAPZEAeViYpaXM4D8C6e3`, ready state `READY`.
- Local and Vercel production builds passed. Live browser renders the 3D title and PLAY/SETTINGS; no console warnings/errors observed.
- `vercel.json` explicitly configures Vite, `npm run build`, and `dist`. `.vercelignore` excludes local environment files, docs, agent files, caches and dependencies; project credentials stay ignored.
- Deployment screenshot: `body-rush-vercel.jpg`.

## A/D correction
- A/D now moves one lane per keydown, matching left/right arrows; S no longer selects center. Physical keys still work with Thai keyboard layout. On-screen arrow buttons remain removed.
- 44/44 tests pass, including right -> A -> center -> A -> left, bounds, arrow equivalence and ignoring S.
- Browser checks confirm D from center reaches right and one A returns to center (not left).
- Production redeployed successfully: `dpl_ExSHtpxw7rawc33xaQ9k1Wv8wSG2`, https://body-rush.vercel.app. Local and production builds pass.

## Food Fit Fun rebrand and mobile gestures
- Tests: 46/46 pass, including left/right swipes, one-lane bounds, taps, vertical/diagonal movements, slow drags and invalid samples. Production build passes.
- UI checked at 390x844: new title fits; swipe hint is visible without arrow controls. Native browser pointer drag drives the actual React gesture handlers: center -> swipe left -> left; swipe right -> center. Touch hardware itself was not available for QA.
- Browser title, intro, title logo, HUD and export filenames renamed; existing IndexedDB/localStorage keys retained.
- Screenshots: `food-fit-fun-mobile.jpg`, `food-fit-fun-swipe.jpg`.
- Vercel project `dream-league1/food-fit-fun` deployed READY: `dpl_7nvQ4TUaF8MEGL588iWUf9m2ekRf`. New production URL https://food-fit-fun.vercel.app verified in live browser, showing new title with no console errors/warnings. Screenshot: `food-fit-fun-vercel.jpg`.

## Mobile camera loading regression
- User reports video preview exists in mobile Safari/Chrome but loading never becomes ready. Physical device reproduction is unavailable; this narrows the issue to detector initialization, not camera permission.
- Red reproduction: `npm run test -- src/game/camera/CameraSession.test.ts` failed because the session refused even to request camera when Worker/bitmap was absent. After fallback implementation the case passes.
- Unit lifecycle coverage: permission cancellation, insecure contexts, absent worker/bitmap support, worker error recovery without closing stream, cancellation during fallback loading, pause/stop during inference, stalled worker fallback and stalled fallback timeout.
- Real browser smoke test (temporary local HTML, removed after verification): lazy-load production MediaPipe factory + classic WASM/model, synthetic canvas video, detect three frames, PASS. This tests real inference and asset compatibility, not a real human pose or physical iPhone/iPad.
- MediaPipe logs its CPU delegate INFO through stderr and internal feedback/OpenGL advisories; three detection calls completed successfully. Screenshot: `camera-fallback-qa.jpg`.
- Final tests: 52/52 pass. Production build passed. Deployed `dpl_HTWzp9UmzhaP9gHWjRCrPz2dgy7q` READY; https://food-fit-fun.vercel.app serves `/assets/index-14Dq5JhR.js`. All four classic/no-SIMD JS/WASM files respond HTTP 200 with expected content types. Initial transient Not authorized rejection resolved on retry after account/project access verification.
- Temporary QA harness removed; temporary local server shut down. Ports 3000/4173 have no listeners. Physical mobile Safari/Chrome still requires user confirmation after refresh.
