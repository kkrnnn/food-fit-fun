> Historical six-table implementation. Superseded by [two-table baseline verification](two-table-analytics-verification.md); the old cloud fixtures/tables were deleted at the user's request.

# Feedback + Supabase analytics verification

วันที่: 2026-10-03 (Asia/Bangkok)
สถานะ: local + actual Supabase/Vercel API + production browser submission verified

## ตรวจแล้ว

- Repository integration tests: after 3 unique completed/game_over runs including demo; abandoned excluded; duplicate terminal write does not increase the count; skip delays by 3 additional runs; one rating persists across reload and later runs
- Existing v1 database upgraded without importing old terminal history; local profile/health persistence remains intact; selected-player clear includes its survey/credential/outbox only
- Outbox tests: offline/config missing and Vite HTML fallback retain pending data; lost server response retries; acknowledged runs precede dependent events/rating; permanent 4xx does not auto-loop; explicit retry; cleared local rows are not sent from a captured batch
- Projection/validation tests: real answer snapshots, counts and bounds; no raw playerId/profile/health/camera/plannedQuestions in cloud payload
- API handler tests with mocked upstream: missing config, public GET restrictions, origins, credential format, payload size/rating, unknown field projection, credential/IP hashes, database error masking, ownership/rate-limit/status mapping
- PostgreSQL 15 isolated temporary cluster: applied migration and ran `supabase/tests/analytics.sql`; run+answers transaction rollback, duplicate prevention, immutable once-per-player rating, credential/ownership denial, RLS/grants, event idempotency and shared rate limiting passed; analytics SQL queries parsed/executed
- Browser component QA with real repository in a separate QA database: 3rd round displays stars with no selection and disabled Send; Skip hides it on rounds 4/5, returns on round 6; choose 4 stars, Send and reload retains thanks and no survey; native keyboard ArrowRight chooses 2 stars and enables Send
- Viewports 390×844 and 1280×900: document scrollWidth equals innerWidth, no horizontal overflow, controls/text visible and usable

## Evidence

- [Mobile component screenshot](feedback-mobile.jpg)
- [Desktop component screenshot](feedback-desktop.jpg)
- Repeatable dev-only preview: `http://127.0.0.1:3012/docs/qa/feedback-preview.html?case=YOUR_NEW_CASE` while Vite runs on that port. Uses `food-fit-fun-feedback-qa-*` database; sends no data to Supabase and is outside the production entry point

## Live cloud verification

- Supabase migration executed successfully on food-fit-fun / `umsquyyfozhggogfnrak`; 6 tables have RLS and anon SELECT=false; unauthenticated REST report read rejected
- Vercel food-fit-fun: 5 server env variables in Production + Preview, key/hash stored as Secret, enabled=true; no server secrets found in browser dist files
- Preview `food-fit-lc7buf698-dream-league1.vercel.app`: 2 independent random identities, 6 demo terminal runs, 6 answer rows, 2 shown events, once-only ratings 4 and 5. Repeated runs/ratings yield no duplicates; wrong identity token 403, invalid stars 400, disallowed origin 403
- Production API at body-rush.vercel.app: same checks passed with separate dataset `qa-feedback-production-v1`
- Final production deployment: [BCqrV9ts7](https://vercel.com/dream-league1/food-fit-fun/BCqrV9ts7ztj1wpv8Wp39mJX2p8g), Ready. Both body-rush.vercel.app and food-fit-fun.vercel.app serve enabled=true and `index-CX5tSoaa.js`
- Real frontend/browser: manual controls, synthetic QA profile/default example measurements, skipped tutorial, answered 2 questions, paused/exited. After final build reload, pending terminal run reached Supabase: `fa1cb0a0-8522-4756-8884-7a51b4775850`, score 102, abandoned, demo=true; health/name/raw player ID absent from stored payload
- Production fixes found by live testing: Node ESM imports need `.js` extension; native browser fetch must not be called with AnalyticsSync as receiver. Added receiver regression test: failed before fix, passes after; real browser pending upload confirmed

## QA dataset and remaining limits

Fixtures remain in cloud as demo data, without deleting any rows. Exclude `content_version like 'qa-feedback-%'` plus browser QA analytics player `e0e1b877-a1cb-4a83-aaf8-89c42285252e` when analyzing participants. There are 12 API fixture runs / 12 answers / 4 ratings across preview+production; the browser QA adds one abandoned demo run

Mounted feedback UI with real storage validates the 3/skip/submit/reload flow; three full production game rounds and two physical devices were not played end-to-end. Independent identities/API uploads and one real browser round were verified. Offline/response-loss are covered by integration tests. Retention/cleanup policy remains an operator decision; no automatic deletion schedule was created

Evidence: [Supabase migration](supabase-migration-success.jpg), [live report](supabase-live-report.jpg), [server env](vercel-server-env.jpg), [production Ready](vercel-production-ready.jpg)

## Build/tests

`npm test`: 22 files / 94 tests passed. `npm run build`: frontend + API/server TypeScript and Vite production build passed. `git diff --check` passed. Production build has the existing large-chunk warning; no new project dependencies were installed; official Vercel CLI used from temporary npm cache
