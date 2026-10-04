# Camera tuning and setup

2026-10-04 · extend the current master gameplay, including the camera exercise timing grace.

## Scope

1. Resize inference frames proportionally to a 480 px maximum edge, preserving the complete image and normalized landmark coordinates. Sample illumination from a small image; show an actionable low-light hint. Keep one inference in flight and recover from a stalled worker. No image upload or recording.
2. Add three levels of lane sensitivity and jump sensitivity, saved on this device. Preserve calibrated center when changing lane sensitivity; reset jump detection so a tuning change cannot create an action. Keep hand-hold start separate from torso jumps.
3. Replace the small floating setup preview with a preview inside Settings: clean mirrored video, actual calibration progress and a short jump confirmation below the image. No skeleton or lane labels anywhere in the camera preview. The same video stays attached when moving between setup, problem dialog and gameplay. Gameplay preview shows only video.
4. Provide recenter and restore-default controls. Explain missing torso, moving during calibration, camera loading/error, and ready states in Thai. Camera control trials in Settings must not change the course or start a round. Tracking loss or a camera error opens one problem dialog; gameplay is frozen and resume requires confirmation after calibration. Light advice belongs in that dialog, not on the playing image.
5. Once the camera is ready, lowering then raising a hand above the shoulder for 1.5 seconds confirms OK in Settings or the camera problem dialog. Dispatch to the active dialog, not the new-run action. Reset after confirmation so a held hand cannot also start another screen. Disable gesture confirmation while deletion confirmation is open.
6. Make camera-mode modal instructions readable from standing distance, with larger headings, copy, buttons and hand-hold progress. Enlarge distant item silhouettes and raise the camera scene view to reveal food previously hidden by the runner. Preserve item lane, exercise height and pickup rules.

## Design

Reuse cream panels, dark purple text, mint highlights, current rounded controls and Thai type. Settings prioritizes the preview, setup guidance, then tuning controls; audio and graphics remain below. Keep technical diagnostics out of the main flow. On mobile the preview stacks above controls with no floating panel covering them.

## Verification

Test complete-frame dimensions and illumination, input tuning/noise/rearming, worker stall cleanup, setup progress, clean gameplay preview, and actionable problem-dialog states. Inspect Settings and the problem dialog on desktop and narrow mobile with camera off and representative simulated pose states. Real camera inference and physical comfort require an actual camera retest; simulated landmarks do not verify detector accuracy. Production deployment on 2026-10-04 is recorded in `docs/qa/camera-tuning-verification.md`.
