# Research bank and denser items — 2026-10-03

## Implemented

- Objective modal uses both supplied research objectives. First number normalized to 1.2.1; duplicated โปรแกรมโปรแกรม in the second objective retained as supplied.
- 50 single item encounters per 180-second round, up from 30: 30 harmful foods, 12 good foods, 3 neutral drinks, 5 airborne exercise items. Random lanes, item bags, category order, and small distance jitter. No missed-item penalty or pickup popup introduced.
- Source DOCX extracted read-only, preserving all 26 authored prompts and their three options. Runtime uses 25 eligible questions; Q5 preserved but excluded because its proposed key is null. Old generated question fixtures removed. Practice and guided tutorial also use source Q1.
- Proposed answer keys are distinct from document text. Source SHA256, question number, draft review status, and version retained. Current round records remain demonstration records, so inferred keys are not silently treated as approved research outcomes.
- Saved imported banks do not override the fixed research bank for gameplay.

## Automated checks

`npm run test`: 81/81 tests across 18 files passed.

`npm run build`: TypeScript and Vite production build passed; existing large-bundle warning remains.

Tests cover exact source/runtime prompt and option matching, 26 source vs 25 playable questions, Q5 exclusion, 10 unique questions per set across 50 seeds, item counts/ratios, minimum spacing, randomized layouts, exercise clearance from quizzes, and question deck rollover.

## Browser checks

Local Vite at http://127.0.0.1:3000/: Objective paragraphs visible, acknowledgment enables OK, Settings reports research bank and proposed keys, Practice displays original Q1 and its original three options, and a round starts with 180 seconds and 10 questions. Screenshots: research-objective.png and research-practice.png.

The DOCX rendering runtime lacks usable Thai font rendering; source text was checked using OOXML extraction, not inferred from blank Thai glyphs in rendered pages. Original document unchanged.

No production deployment in this change. Physical mobile camera/swipe/audio validation remains outside this change.

Live round DOM also verified source Q24: ข้อใดเป็นกิจกรรมที่ใช้กล้ามเนื้อ, with shuffled original choices นั่งดูการ์ตูน / ปีนป่าย / นอน. Correct selection reset wrong streak from 1 to 0. QA round exited to title after verification.

## Follow-up: 100 items per round

User requested 100 instead of 50. Layout now has 10 single encounters per segment: 60 harmful foods, 24 good foods, 6 neutral drinks, 10 airborne exercise items. Duration remains 180 seconds; encounters occur about every 1.08 seconds in item sections, with a minimum 1-second gap. Quiz approach remains free of items. Exercise items keep more than 3 seconds clearance from the previous gate and the next quiz approach. Level version advanced to v8. Automated tests (81/81) and production build passed after this change; browser screenshots above describe the earlier 50-item version.
