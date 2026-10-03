# BMI meter, jumping and continuous course

2026-10-03. User requested implementation; preserves the existing two-table Supabase contract.

- Expand the bundled CDC BMI-for-age reference from ages 9–12 to ages 2–19 using the full source CSV already checked into the repository. Age 20+ uses CDC adult thresholds 18.5 / 25 / 30. Under age 2 shows an unavailable age reference, not a fabricated category. Whole-year child age uses the range of all twelve monthly rows; no guessed birth month. Raw BMI remains weight (kg) / height (m)².
- Raise the shared jump arc. Ground items are collected only below the clearance height; jumping over them has no BMI or item-count effect. Airborne exercise collection uses the same arc, with pause/control loss cancelling a jump.
- Keep future food items visible behind the gate during its approach. Render upcoming gates within the same course horizon before the question banner opens. Existing item positions, no-item answer corridor, gate resolution, scoring and question count remain intact.
- Remove the administrator screen, import/export controls and caretaker energy summary from the player flow. Use only the existing research question set; preserve the source's provisional answer provenance and locally saved profiles/runs/star feedback.

Verification: age boundary/reference tests; jump clearance/landing/pause behavior; continuous food/gate presentation across approach and crossing; full tests/build; desktop and mobile browser QA.
