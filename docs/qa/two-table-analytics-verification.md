# Two-table baseline verification

2026-10-03, Asia/Bangkok. Supersedes the six-table QA report.

## Implemented

- Public application schema: `score`, `feedback`, exactly two tables. User explicitly authorized deleting all old application tables/data and starting fresh.
- Score snapshots: nickname, sex, age in years, actual starting BMI, simulated ending character BMI, correct answers out of 10, game points. Individual questions/answers, height/weight and camera data are not uploaded.
- Feedback JSONB: `{player_name, stars}`, once per local player. Shown/skip state remains local, with no cloud event rows. Retired queued events are acknowledged locally without upload.
- Existing local survey rule remains 3 completed/game_over rounds, skip another 3, submitted never asks again. The cloud context must be owned and terminal; it does not require three cloud rows after a reset.

## Verification

- `npm test`: 22 files / 97 tests passed. Covers snapshot projection, invalid BMI/scores/stars, legacy pending payloads, no fabrication of missing values, local survey/reload, event retirement, offline/lost response/idempotency, native browser fetch receiver and API validation/ownership/status handling.
- `npm run build`: TypeScript frontend/API/server and Vite passed. Existing large bundle warning remains.
- Disposable PostgreSQL 15: reset + standalone baseline + registration + two-table SQL tests passed. Verified exactly two public tables, empty after reset, requested score fields, JSONB stars, immutable retries, token ownership, RLS/grants, rollback of invalid scores, old API compatibility and 60 new scores/minute/player limit. Test fixtures roll back.
- Supabase project `umsquyyfozhggogfnrak`: destructive migration succeeded; all six old tables and two old report views removed. Baseline metadata `20261003000100 / create_score_feedback` registered in private `supabase_migrations` schema. Both data tables start empty.
- Production deployment [8ZvruLBr](https://vercel.com/dream-league1/food-fit-fun/8ZvruLBrCBEtXUKAFZLE6k3hqWCM), Ready. Both body-rush.vercel.app and food-fit-fun.vercel.app serve `index-DiLgOmx8.js` and enabled=true.
- Actual POST feedback with a nonexistent random context returns 409/missing_run on both domains: server secret successfully executes the new two-table RPC. No rows inserted. Secret-key reads confirm both tables empty; anonymous reads denied.

## Migration layout

Only `supabase/migrations/20261003000100_create_score_feedback.sql` is active. Historical experimental SQL is archived outside migrations. Explicit destructive reset is separate in `supabase/reset-analytics.sql`. SQL Editor fallback registration is separate in `supabase/register-baseline.sql`; normal authenticated CLI db push handles tracking itself. CLI authentication was not configured in this task.

## Evidence and limits

[Database tables and version](two-table-baseline.jpg). Valid score/star field writes were verified in transactional SQL/local integration tests; the final production schema was intentionally kept empty, so no new persisted end-to-end game/star fixture is claimed. Earlier browser UI QA verified the unchanged star interaction and once-only rule; camera and two physical devices were not tested here.

No secrets are included in tracked files or browser bundle. Profiles/answer histories and submitted survey state already saved locally remain after cloud reset; empty cloud history does not imply empty local storage.

## Production domain cleanup

At the user's request, removed `body-rush.vercel.app` from the `food-fit-fun` Vercel project. Project domain settings now list only `food-fit-fun.vercel.app` with Valid Configuration. The main site returns HTTP 200, GET `/api/analytics/runs` returns HTTP 200 / `enabled=true`, and an unauthenticated POST from the main origin reaches identity validation (401 / `invalid_identity`). The retired domain returns HTTP 404. No redeploy or data reset was needed. [Domain settings](vercel-food-fit-fun-domain.jpg).
