# Task 344 Checkpoint - Community Events / Scheduled Sessions

## Status

Completed as a post-MVP documentation-first foundation.

## Changed files

- `docs/community-events-scheduled-sessions.md`
- `scripts/community-events-foundation-smoke-test.mjs`
- `docs/task-checkpoints/task-344-community-events-scheduled-sessions.md`
- `package.json`

## What changed

- Documented future community events data model, RSVP model, Supabase Auth/RLS expectations, LiveKit scheduled session boundaries, notification rules, validation, and audit/privacy requirements.
- Added a smoke test that checks the required safety and architecture sections.
- Runtime UI and LiveKit behavior were intentionally left unchanged.

## Commands run

- `npm run events:foundation:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Start Picom.
2. Confirm no new Events UI appears in the current desktop shell.
3. Confirm existing community/channel/message/voice flows still work.
4. Review `docs/community-events-scheduled-sessions.md` before future scheduled session work.

## Notes

- No tokens, passwords, authorization headers, or session values are logged by this task.
- Supabase migrations and runtime event UI remain post-MVP.
