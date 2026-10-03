# BMI, jumping and continuous course verification

2026-10-03, Asia/Bangkok.

## Result

- BMI reference now bundles 432 monthly CDC rows for ages 2–19 (both sexes), generated reproducibly from the existing full CSV with `scripts/build-bmi-reference.py`. Adult ages 20+ use 18.5 / 25 / 30. Whole-year child ages retain the twelve-month uncertainty range. Under age 2 remains neutral, with no invented interpretation. Sources and implementation rationale: [research note](../research/bmi-age-reference.md).
- Shared jump arc peaks at 3.4 scene units (previously 1.8), lasts 850 ms and clears ground items above 2.1 units. A ground item passed while high enough is not collected and does not change simulated BMI; a landed runner collects normally. The same arc drives the renderer and collision rule. Pause and invalid control cancel the jump.
- Visibility uses a continuous 224-unit course horizon. Food behind the gate remains visible in running, quiz approach and answer feedback; item mesh IDs persist across those transitions. Gate rendering enters that horizon before the question banner, retaining the original 6-second answer timing and no-item answer corridor.
- Removed the administrator entry points and caretaker energy summary from the player flow. Only the existing research question set is used (25 eligible questions; draw 10 each round). Its original provisional answer provenance remains in the bank. Local storage, star feedback and Supabase score/feedback contract remain intact.

## Verification

- Full Vitest suite: 22 files / 101 tests passed. Added all-year/both-sex BMI coverage, child/adult age boundary and exact adult threshold checks, jump-over versus landed collection, and food continuity across the gate boundary.
- TypeScript + production Vite build passed. Existing bundle-size warning remains. `git diff --check` passed.
- Actual Three.js renderer inspected in isolated dev QA snapshots at desktop 1280×720 and mobile 390×844. Food remains visible behind the gate; same items move closer after crossing. High jump clears the ground pizza on both screen sizes. No rendering errors in the fixture log.
- Actual game flow inspected at 390×844: created an isolated localhost QA profile age 30, height 175 cm, weight 72 kg; starting BMI 23.5 had adult green classification. Skipped practice and ran through two gates before pausing/exiting. Settings lists the fixed question set and player controls with no administrator entry. No full three-minute round or camera jump was tested.
- Dev-only `course-preview.html` / `.tsx` uses the real RunSession and GameEngine3D with fixed snapshots; it has no storage/network/camera and is not a production entry point. Local actual-game QA used a separate localhost port; no QA score/star was submitted to Supabase.

## Evidence

- [Food behind gate](course-food-behind-gate.jpg)
- [Food after crossing](course-after-gate.jpg)
- [High jump desktop](course-high-jump.jpg)
- [High jump mobile](course-high-jump-mobile.jpg)
- [Player settings mobile](player-settings-mobile.jpg)

## Production

Deployed to [Food Fit Fun](https://food-fit-fun.vercel.app), [deployment C6cdPoS5E](https://vercel.com/dream-league1/food-fit-fun/C6cdPoS5Eb7v4Ah25C3jV3fBQKtg), READY / Production. Live site returns HTTP 200 and serves `/assets/index-QAYJtLc0.js`; GET `/api/analytics/runs` returns HTTP 200 / `enabled=true`. The retired body-rush domain still returns HTTP 404. No database migration/reset was required for these gameplay changes.
