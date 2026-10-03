# Android swipe-up jump fix — 2026-10-03

## Cause and fix

The gameplay root used `touch-action: pan-y`. That explicitly gives vertical touch panning to the browser. When the browser claims that gesture it can send pointercancel instead of pointerup, while LearningGame dispatches swipeJump only on pointerup. Pointer capture cannot override browser gesture arbitration. Reference: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action

Changed the manual gameplay surface to `touch-action: none`. Apply its class only during active play or guided practice; ordinary pause overlays regain normal browser gestures. No jump timing, distance thresholds, camera gestures or hit detection were changed.

Ranked alternatives considered: browser vertical-pan interception, delayed dispatch at pointerup, and swipe direction threshold. The first had a concrete contradictory CSS contract; the latter two did not require changing once this contract was corrected.

## Reproduction and regression boundary

`npm run test -- src/features/learning/TouchSurface.test.ts` failed before the fix: expected none, received pan-y. This locks the browser gesture contract at the shipped CSS seam; it does not simulate a physical Android pointer event trace.

After fix, gesture classification and exercise/jump tests pass. Local browser computed styles verified on the actual app: active manual run `lr-touch-run` has touchAction=none; paused run removes the class and has touchAction=auto. QA round exited normally afterward. No debug instrumentation added.

Physical Android is not available in this environment, so the exact device symptom has not been directly reproduced or verified. The likely blocking browser policy is corrected; retest a fresh production page on the affected Android device.
