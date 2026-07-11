# Task 461 checkpoint: friend request services, realtime, and notifications

## Result

Completed the friend request service lifecycle for mock and Supabase modes.

- Consolidated friend lifecycle operations behind `friendRequestService` and a mock/Supabase data-source contract.
- Preserved the existing `relationshipService` facade and kept one-way Follow behavior separate.
- Added stable typed errors for auth, privacy, blocking, duplicates, direction, cooldown, rate limits, network, and unknown failures.
- Added canonical incoming, outgoing, pending, and friendship counts.
- Added coalesced Realtime subscriptions for both request directions and both normalized friendship columns.
- Added complete subscription cleanup for channels, local listeners, and pending refresh timers.
- Added recipient-private/idempotent notification publication contracts.
- Added Friend requests and Friend request acceptances preferences in Settings.
- Centralized friend inbox/desktop notification routing through existing notification policy services.

## Commands and results

Passed:

- `npm run friends:services:smoke`
- `npm run friendship:foundation:smoke`
- `npm run friends:production:smoke`
- `npm run blocking:privacy:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run supabase:smoke`
- `npm run supabase:rls:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Performance remained within hard gates:

- initial JS: 1530.2 KiB / 1650.0 KiB hard cap
- initial CSS: 227.3 KiB / 240.0 KiB hard cap
- total assets: 2980.6 KiB / 3500.0 KiB hard cap

## Manual and external validation

- Mock lifecycle paths are covered deterministically for list/send/accept/decline/cancel/remove/block state transitions and count updates.
- Static service contracts verify four Realtime relationship filters, notification preference routing, cleanup, duplicate protection, and RLS publication setup.
- A live two-session Supabase Realtime notification/count test is **BLOCKED** because the Supabase CLI and an isolated configured hosted test environment are unavailable. No hosted pass is claimed.
- No interactive desktop UI smoke was run for this service-only task; existing renderer build and QA contracts passed.

## Remaining risks

- Realtime delivery latency and reconnect behavior still require the hosted two-session validation above.
- Existing renderer bundle target warnings remain documented exceptions but all hard performance caps pass.
- Existing Vite `voiceService` static/dynamic import warning is unrelated to this task.
