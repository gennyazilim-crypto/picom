# Task 357 Checkpoint - Bot API Architecture Document

## Status

Completed as a post-MVP architecture document.

## Changed files

- `docs/bot-api.md`
- `scripts/bot-api-architecture-smoke-test.mjs`
- `docs/task-checkpoints/task-357-bot-api-architecture-document.md`
- `package.json`

## What changed

- Documented bot auth model, token safety, permissions, rate limits, events, actions, message send API placeholder, slash command registration, webhook comparison, audit logging, abuse prevention, developer portal placeholder, and versioning.
- Added a smoke test to verify required Bot API architecture sections.
- Runtime code was intentionally not changed.

## Commands run

- `npm run bot-api:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## How to test manually

1. Review `docs/bot-api.md`.
2. Confirm token safety, rate limits, audit logging, and abuse prevention are covered.
3. Start Picom and confirm no Bot API UI/runtime appears in the MVP app.

## Notes

- No bot tokens, routes, SDKs, or marketplace behavior were added.
- Bot API remains post-MVP.
