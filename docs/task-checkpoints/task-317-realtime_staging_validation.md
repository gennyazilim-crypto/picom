# Task 317 - Realtime staging validation

## Result

Hosted execution is **blocked / not run** as of 2026-07-10 because no staging URL/key, two synthetic user
credentials, or fixture community/channel IDs are available. No network connection was attempted and no
credential was exposed.

## Prepared coverage

- Two distinct authenticated clients.
- Message INSERT, UPDATE, and DELETE delivered exactly once to both clients.
- Typing Broadcast and two-client Presence.
- Socket disconnect/connect and post-reconnect delivery.
- Runtime dedupe markers and message/typing/presence cleanup contracts.
- Final removal of every Realtime channel and cleanup of the synthetic message.

## Validation

- `npm run realtime:staging:preflight`
- `npm run realtime:staging:test` - expected blocked until secure staging values exist.
- `npm run realtime:staging:contract:test`
- `npm run realtime:deduplication:smoke`
- `npm run supabase:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

See `docs/realtime-staging-validation.md` for the secure fixture and execution procedure. A real hosted pass
remains a P1 release gate.
