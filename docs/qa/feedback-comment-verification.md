# Feedback comment verification

2026-10-03–04, Asia/Bangkok.

- Optional Thai textarea alongside required 1–5 stars, 1,000-character limit and counter. Empty/whitespace comments are omitted; trimmed text and line breaks persist in local survey state and the atomic delivery outbox.
- Preserved ask-after-three, skip another three, once-only submission and old star-only payloads. Repeat delivery does not replace the original rating/comment.
- Incremental migration `20261003000200_feedback_comment.sql` updates the existing JSONB constraint and ingest function, with no new application table or data reset. Comments are available in `supabase/analytics-queries.sql` exports.

## Verified

- 24 test files / 106 tests passed; TypeScript/Vite production build passed. Existing bundle-size warning remains.
- New integration checks exercise comment reload, synchronization, immutable repeat submission, empty/legacy payloads, Thai/emoji text and the 1,000-character boundary. API rejects non-string and oversized comments before database calls.
- Disposable PostgreSQL 15: both existing two-table tests and new transactional comment tests passed. Tested stored JSONB, trimming, empty omission, invalid/null/oversized rejection, retry preservation, two-table count and private RPC grants. All fixtures rolled back.
- Browser actual FeedbackPanel: desktop 1280×900 and mobile 390×844, Thai/emoji comment entry, star selection, submission and reload. Feedback stayed submitted after reload. Isolated QA IndexedDB only, no browser cloud submission.
- Supabase project `umsquyyfozhggogfnrak`: migration and version registration succeeded. Repeated the comment SQL checks with fresh synthetic UUIDs inside a rollback transaction; result `comment_ingest_rollback_passed`. No test rows persist.
- [Production deployment](https://vercel.com/dream-league1/food-fit-fun/6938HZbGKYKYCqFGEt1yMY6UkejM) READY, aliased to [Food Fit Fun](https://food-fit-fun.vercel.app). Live home HTTP 200 / `index-C9jVdtxr.js`; analytics enabled=true. A valid comment with a nonexistent context reached the RPC and returned 409/missing_run; oversized text returned 400/invalid_payload. Neither request created rows.

## Evidence

- [Desktop](feedback-comment-desktop.jpg)
- [Mobile](feedback-comment-mobile.jpg)
- [Migration versions](feedback-comment-migration.jpg)
- [Rollback-only Supabase test](feedback-comment-database-check.jpg)
