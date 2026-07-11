# Friends and Direct Messages Full MVP QA

Date: 2026-07-11

## Result

Local Full MVP QA is **PASS**. Hosted Supabase RLS and two-client Realtime execution is **BLOCKED** because protected staging credentials are unavailable and repository secret inventory access returned HTTP 403. No hosted success is claimed.

## Acceptance coverage

| Area | Evidence | Result |
| --- | --- | --- |
| Friend request lifecycle | foundation, production, services/realtime, UI smokes | PASS |
| Suggestions and safe presence | Friends UI/presence smoke | PASS |
| Open DM and conversation switching | Friends UI + DM production/layout smokes | PASS |
| Send, retry, edit, delete, reply, react | DM interactions + services smokes | PASS |
| Attachment upload/recovery | DM interactions + completed schema/Storage contract | PASS |
| Read/unread and preferences | DM services/realtime smoke | PASS |
| Block, mute, report | DM privacy safety, blocking privacy, report workflow tests | PASS |
| Details, media, profile navigation | DM layout/interactions smoke | PASS |
| Verified identity | verification badge smoke | PASS |
| Participant-only access | DM schema/RLS and production-safe RLS contracts | PASS (structural) |
| Reconnect, ordering, dedupe, cleanup | realtime contract/order/dedupe/scaling/backpressure/load smokes | PASS |
| Two-client hosted Realtime | protected staging runner preflight only | BLOCKED |
| Hosted RLS identities | protected staging runner preflight only | BLOCKED |
| Desktop visual screenshots | 22-scenario visual coverage contract | PASS (contract); pixel run NOT RUN |
| End-to-end UI automation | 16-flow E2E coverage contract | PASS (contract); runner NOT RUN |

## Commands

### Friends and DM

- `npm run friendship:foundation:smoke`
- `npm run friends:production:smoke`
- `npm run friends:services:smoke`
- `npm run friends:ui:smoke`
- `npm run dm:production:smoke`
- `npm run dm:services:realtime:smoke`
- `npm run dm:interactions:smoke`
- `npm run dm:layout:smoke`
- `npm run dm:schema:rls:smoke`
- `npm run dm:schema:completion:smoke`
- `npm run dm:privacy:safety:smoke`
- `npm run blocking:privacy:smoke`
- `npm run reports:production:test`
- `npm run profile:privacy:smoke`
- `npm run verification:badges:smoke`

### Realtime, RLS, visual, and E2E

- `npm run supabase:rls:production-safe`
- `npm run supabase:rls:hosted:preflight`
- `npm run realtime:staging:preflight`
- `npm run realtime:staging:contract:test`
- `npm run realtime:ordering:smoke`
- `npm run realtime:deduplication:smoke`
- `npm run realtime:backpressure:smoke`
- `npm run realtime-scaling:smoke`
- `npm run realtime:load:smoke`
- `npm run visual:regression:contract`
- `npm run e2e:coverage:contract`

### Core gates

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

All listed local commands passed.

## Findings fixed

1. The DM layout smoke expected every avatar to use a literal `medium` variant. It now verifies the approved compact/medium non-aura split and still rejects profile aura in DM.
2. The realtime ordering smoke expected a retired multi-channel cleanup string. It now verifies both active-conversation and list-subscription `guard.clear()` plus `removeChannel()` cleanup paths.

No Picom product feature or UI behavior changed in this QA task.

## Performance

- Initial JS: 1555.6 KiB, below 1650 KiB hard cap.
- Initial CSS: 229.8 KiB, below 240 KiB hard cap.
- Total assets: 3029.0 KiB, below 3500 KiB hard cap.
- Existing target warnings remain for initial JS, CSS, and total assets.

## Manual and hosted gaps

- No interactive Electron window test was fabricated in this task.
- Pixel screenshot execution remains intentionally inactive until Playwright/platform baselines are enabled.
- Live two-client Supabase Realtime and authenticated multi-role pgTAP/RLS execution require the protected staging variables listed by the preflight scripts.
- Supabase CLI is unavailable locally.
- Build retains the known `voiceService` static/dynamic import warning; it is outside Friends/DM QA scope.
