# Food Fit Fun: shared database proposal

Status: BACKLOG — deferred by the user on 2026-10-03 (Asia/Bangkok).

Update 2026-10-03: user resumed central run/answer/feedback analytics with Supabase; implementation is now local and awaits a Supabase project. See [feedback plan](feedback-supabase-analytics.md) and [setup](../setup/supabase-analytics.md). The historical local-only scope below is superseded for central analytics. Profile synchronization and cross-device player accounts remain backlog.

## Historical accepted scope before resuming analytics

Keep data local to each device/browser and separate players by playerId. The existing IndexedDB repository remains the local persistence implementation; localStorage holds preferences and the active player reference. No cloud synchronization, shared analytics, or cross-device history is being implemented now. The user described this as localstorage per player first.

The shared database proposal below is future work. Provider, authentication and whether to synchronize player profiles remain undecided. Do not provision a database or deploy synchronization until that backlog is explicitly resumed.

## Behavior before resuming analytics

`RunRepository` writes profiles, runs, question exposure and settings to browser IndexedDB `body-rush-learning-v1`. Vercel serves the static build; there are no server API routes or remote database client. Another device, browser, or origin has its own database. Deploying does not upload those records.

## Scope decision

1. Central caregiver analytics: collect pseudonymous run/answer results from all devices; profiles and personal high scores remain local.
2. Central analytics plus cross-device player history: additionally introduce a player credential/recovery flow and account-scoped history. Nickname alone is not an identity or access credential.

Do not expose all children's profiles/history through a public read endpoint. Central caregiver analytics needs authenticated access. Do not upload raw weight, height, BMI, camera images, or videos for analytics; age in years and versioned answers/scores are sufficient for the current educational reports. Any requested profile synchronization needs a separately defined private profile contract.

## Implementation

- Add Vercel server API backed by a managed database. Keep database credentials on the server.
- Preserve local saving with an IndexedDB outbox. Send completed/game-over/abandoned records, not every rendering/progress tick. Display saved locally / pending sync / synced states.
- Use runId as an idempotency key. Validate input and version fields server-side; do not let late retries erase a terminal result or persisted answers.
- Persist versioned run and answer snapshots so updated question content does not rewrite past learning results.
- Make analytics read the shared, authenticated dataset rather than the browser's local array; distinguish local and shared reports.
- Separate clearing local device records from deleting remote data. No automatic bulk deletion or upload of existing local records.
- Existing local results can be migrated through an explicit reviewed import; new URL origins cannot read old-origin IndexedDB.
- If cross-device history is selected, add account-scoped access, credential recovery and conflict rules before syncing profiles/decks.

## Verification

- Two fresh browser/device sessions produce results in the same caregiver dataset.
- Repeated upload of the same run creates one run and one set of answers.
- Offline completion saves locally and syncs once connectivity returns.
- Unauthorized analytics requests fail; one player's credentials cannot read another's profile/history.
- Invalid records are rejected; cloud failure is visible and does not erase local results.
- Real deploy requires a configured database and caregiver authentication. Do not label local-only saving as synced.
