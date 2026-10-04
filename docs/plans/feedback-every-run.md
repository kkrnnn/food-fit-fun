# Feedback after every run

2026-10-04. Ask for optional 1–5-star enjoyment feedback and an optional comment after every completed or game-over run. Skipping closes only that run's prompt; the next run asks again. A submitted run is immutable across reloads and retries. Abandoned/in-progress runs are not eligible.

Store a decision per run in local IndexedDB, migrating existing completed runs as historical so an upgrade does not reopen old prompts. Keep the previous per-player count only for the existing analytics payload field. Use a new Supabase migration to make `feedback.score_id` the primary key, retaining existing rows and both application tables. The RPC remains idempotent per score ID. Confirm local upgrade and multi-run delivery, SQL row retention/retries, actual UI, and production API before deploying and committing.
