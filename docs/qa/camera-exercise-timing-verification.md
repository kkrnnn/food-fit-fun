# Camera exercise pickup timing

2026-10-04 · based on master `3a2f8f3`

User clarified that the physical jump was mistimed rather than unrecognized by the camera. The previous exercise rule sampled the same ground-clearance height used to avoid food at the exact item crossing. A calibrated torso-jump pulse could succeed while the exercise pickup still failed.

`npm test -- src/game/learning/CameraExerciseTiming.test.ts` reproduced two failures before the change: a physical jump 0.9 seconds before the item, and 0.05 seconds before it, each delivered through the real JumpGesture with a simulated 125 ms pose frame delay. The detector and RunSession accepted the jump but did not award the item.

The camera exercise rule now accepts a recognized jump up to 1,100 ms before crossing, or a fresh jump within 250 ms after crossing. The item remains visible during that late grace. The player must stay in the item's lane; changing lanes, invalid tracking, pause, or switching input mode cancels a pending pickup. Missing an exercise remains optional. Ground-food collision, jump animation, manual controls, kcal estimates, and question rules are unchanged. The course version is `learning-camera-exercise-grace-v10`.

Validation: the timing suite covers early/late recognition, single deductions, no jump, expired timing, wrong lane, leaving and returning, invalid pose/tracking, pause, mode changes, simulation frame sizes, and the manual collision rule. The full suite passed 172 tests with one unrelated ParkWorld geometry test exceeding the default 5-second timeout; isolated rerun with one worker and a 30-second timeout passed that test and all relevant gameplay suites (62 tests, including two additional cancellation cases). All 175 current tests have passed across those runs. Production build and diff check passed.

No real camera timing trace or physical-device playtest was captured. The 125 ms frame delay is a controlled test scenario, not a measurement of the user's camera. The new grace values still need a comfort retest with the user's camera. No push or deployment performed.
