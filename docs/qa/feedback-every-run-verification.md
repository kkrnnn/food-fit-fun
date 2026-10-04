# Feedback after every finished run

2026-10-04, Asia/Bangkok.

The result screen asks for 1–5 stars and an optional comment after every completed or game-over run, including demo runs. Skipping closes only that run; the next result asks again. Submitting, reloading or retrying cannot overwrite a decision for the same run.

IndexedDB version 3 stores feedback decisions by run ID. Its upgrade marks existing terminal results as historical, so opening an old result does not create a new prompt. Existing queued scores and feedback remain available to sync. Cloud outbox IDs now use `feedback:<runId>`.

The Supabase migration `20261004000100_feedback_every_run.sql` makes `score_id` the feedback primary key and adds a `player_id` index. The two application tables and their rows remain. The live project had 12 score and 2 feedback rows before and after migration, and its new version was registered. A rollback-only live test submitted feedback for two distinct runs of one synthetic player, verified retry immutability and left the totals at 12/2.

24 test files / 107 tests passed. Tests cover per-run skip/submit/reload, two feedback deliveries for one player, v1/v2 IndexedDB upgrades, historical results and legacy pending feedback. TypeScript/Vite build passed. Previous SQL tests plus the new two-run test passed in disposable PostgreSQL. The existing bundle-size warning remains.

The local preview on port 3012 remains stopped as requested. [Supabase verification](feedback-every-run-supabase.jpg).

[Production deployment](https://vercel.com/dream-league1/food-fit-fun/6SrMX5xaU1L5W7Pcf3bnKriWdzwD) reported READY and is aliased to [Food Fit Fun](https://food-fit-fun.vercel.app). The live homepage returned HTTP 200 with `index-C4EiDsb0.js`; GET `/api/analytics/runs` returned HTTP 200 with `enabled=true`.
