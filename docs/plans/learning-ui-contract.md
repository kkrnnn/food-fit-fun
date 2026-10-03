# Learning mode design contract

2026-10-02. Latest user direction: modal introduction, title with PLAY/SETTINGS, profile after Play, live answer gates.

- Pastel 3D world, plum typography, violet controls, prominent pink PLAY, yellow selected gate; retain Chakra Petch.
- First screen: centered Introduction/Objective modal, checkbox unlocks OK. Title follows with only primary game actions.
- Profile takes nickname, whole-year age, sex, height, weight and avatar color. No month/activity input. Scrollable sheets for narrow/short screens.
- Running HUD prioritizes distance/question/streak; quiz prompt above scene, answer cards in the same top panel and 3D answer gates correspond spatially to lanes; no visible number or lane-name prefixes.
- Quiz never pauses gameplay or asks a Ready/Continue click; feedback is transient while running. Explicit user/tracking/visibility pause still freezes simulation.
- Camera preview stays mounted and never covers question/answer controls. Settings/calibration and manual fallback are available.
- Modal focus is trapped, underlying content inert. Selected lanes use color plus labels/outline.
- Results separate answered, correct and unreached; review only asked questions. Draft runs are labelled and excluded from real analytics.
- Health numbers stay in caregiver disclosure: raw BMI initializes character proportions and stays unchanged; separately labelled simulated BMI responds to items; whole-year age prevents inferred monthly categories; absent activity means no EER number.
- Required states: loading, no saved player, draft/cancel/save profile, camera requesting/calibrating/error/lost, pause/countdown, continuous approach/feedback, finish/Game Over, no real analytics, invalid import, save failure/retry and delete confirmation.
- Course runs at 16 units/sec for 180 seconds; question ten is the finish gate and resolving it ends the run immediately.
- Verify desktop/narrow views, early failure, full finish, replay, reload and caregiver export. Physical webcam playtest must be reported separately.
