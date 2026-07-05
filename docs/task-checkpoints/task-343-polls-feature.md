# Task 343 Checkpoint - Polls Feature Foundation

## Status

Completed as a post-MVP documentation-first foundation.

## Changed files

- `docs/polls-feature-foundation.md`
- `scripts/polls-feature-foundation-smoke-test.mjs`
- `docs/task-checkpoints/task-343-polls-feature.md`
- `package.json`

## What changed

- Documented future polls data model, Supabase/RLS expectations, service methods, realtime events, validation rules, and feature flag behavior.
- Added a smoke test that verifies required poll architecture sections exist.
- Runtime message composer and message list behavior were intentionally left unchanged.

## Commands run

- `npm run polls:foundation:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Start Picom.
2. Confirm normal message sending still works.
3. Confirm no poll creation button appears in the MVP composer.
4. Review `docs/polls-feature-foundation.md` before future schema or runtime implementation.

## Notes

- This task does not add Supabase migrations or runtime poll UI.
- Polls remain post-MVP until explicitly prioritized.
