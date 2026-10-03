# Feedback comment

Add an optional Thai comment field alongside the existing required 1–5 stars. Limit to 1,000 characters, trim outer whitespace and omit empty comments. Preserve ask-after-three, skip, offline queue, once-only submission and legacy star-only payloads. Store comment in the existing feedback JSONB with no new application tables.

Apply a new incremental migration to update the JSONB constraint and ingest function; preserve existing rows and privileges. Verify repository reload/retry, API rejection of malformed comments, transactional PostgreSQL behavior, and desktop/mobile submission. Then deploy to Food Fit Fun and commit the authorized code changes from this session. Do not commit credentials or local runtime files.
