# Task 463 checkpoint: Direct Messages schema and RLS completion

## Result

- Added a normalized active participant pair and partial unique index for one-to-one conversation identity.
- Made create-or-open concurrency-safe with an advisory transaction lock and unique-conflict recovery.
- Retained legacy duplicate conversations as archived, readable, superseded history while preventing new activity.
- Added immutable identity/reply fields, same-conversation reply validation, bounded client IDs, and canonical message lifecycle checks.
- Added atomic reply send with idempotent `DO NOTHING + SELECT` retry reconciliation.
- Added author-only edits, one-way body-redacting soft delete, and revoked authenticated hard delete.
- Added precise `last_read_message_id`, participant mute/archive preferences, and supporting indexes.
- Tightened active-message reaction and author-owned attachment metadata policies.
- Added private DM Storage bucket policies bound to conversation, message, uploader, and participant access.
- Preserved block policy: blocks prevent send/edit/reaction/upload while read, own cleanup, and soft delete remain safe.
- Updated the service layer so replies are linked atomically during send rather than by a second direct update.
- Added hosted-ready pgTAP coverage for idempotency, reply boundaries, participant/outsider access, edit/delete, reactions, preferences, and read state.

## Commands and results

Passed:

- `npm run dm:schema:completion:smoke`
- `npm run dm:schema:rls:smoke`
- `npm run dm:production:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run supabase:smoke`
- `npm run supabase:rls:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Performance remained within hard gates:

- initial JS: 1533.7 KiB / 1650.0 KiB
- initial CSS: 229.6 KiB / 240.0 KiB
- total assets: 2990.6 KiB / 3500.0 KiB

## Manual and external validation

- Static contracts cover the complete schema/service/storage/RLS boundary and existing DM regression tests pass.
- Interactive DM UI behavior was not changed beyond atomic reply send wiring; renderer build and deterministic QA passed.
- Live migration application, pgTAP execution, bucket policy upload/read/delete, and two-user RLS verification are **BLOCKED** because the Supabase CLI and isolated configured Supabase environment are unavailable. No hosted pass is claimed.

## Remaining risks

- The forward migration requires execution against an isolated staging database before production rollout.
- Legacy duplicate conversations are retained as superseded history rather than destructively merged; retention review may later hard-delete them under an approved policy.
- Existing unrelated renderer soft-budget and `voiceService` import warnings remain unchanged.
