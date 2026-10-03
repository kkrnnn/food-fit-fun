# Feedback + score: revised scope

Confirmed 2026-10-03: exactly two application tables, `feedback` and `score`.

- `score`: one row per run; nickname, sex, age in years, starting BMI, ending simulated character BMI, correct answers out of 10, game score. IDs/times, outcome and demo/content provenance support retries and interpretation. A private token hash verifies ownership without a separate players table.
- `feedback`: one row per player who submitted stars. JSONB `data = {player_name, stars}` plus player/run IDs and timestamp. No cloud impressions, skips, individual answers or separate rate counter table.
- Keep local question/answer history and the existing ask-after-3 / skip-another-3 / once-submitted behavior.
- Snapshot nickname/sex on the run at start. Older local records may lack profile snapshots; they remain NULL rather than inferred from edited profiles. The user explicitly requested deleting old cloud data and starting fresh.
- Retain exact-origin validation, server-only key, RLS, token ownership, immutable retries and limits on new score submissions. The two-table schema does not keep counters for repeated API attempts.

## Cutover

1. Implement compact contract/API, local survey changes and tests.
2. Prepare transactional SQL: create two empty tables, replace RPC, then drop the six old tables and two report views. Keep compatibility with the previous API/client during the cutover.
3. Test against disposable PostgreSQL. User authorized resetting all old cloud tables/data on 2026-10-03.
4. The user explicitly instructed removing the old tables and recreating an empty schema. Execute that authorized reset after the implementation and SQL checks are ready.
5. Execute approved cutover, deploy, verify actual score/profile/BMI/JSONB feedback in Supabase and both production aliases. Update setup/QA evidence.

Migration: `supabase/migrations/20261003000100_create_score_feedback.sql`. Experimental migrations are archived outside the active migrations directory. The user requested a standalone baseline and a separate reset script. Production has been reset and deployed; version metadata is registered. See docs/qa/two-table-analytics-verification.md.
