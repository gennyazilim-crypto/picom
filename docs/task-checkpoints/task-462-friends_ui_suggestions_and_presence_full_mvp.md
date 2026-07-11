# Task 462 checkpoint: Friends UI, suggestions, and presence Full MVP

## Result

- Completed controlled All, Online, Pending, Suggestions, and Blocked desktop sections.
- Connected DM sidebar Friends and Pending requests shortcuts to the correct Friends tab.
- Kept service counts authoritative for friends and pending requests.
- Completed accept, decline, cancel, remove, block, unblock, profile, and DM actions.
- Added keyboard-accessible tabs, search, focus states, semantic buttons, and empty states.
- Kept verification name-adjacent while presence uses a separate bottom-right status dot.
- Added a privacy-aware Supabase suggestion RPC using shared community and Follow signals.
- Excluded blocked, existing, pending, self, and privacy-denied users from suggestions.
- Added RLS-protected friend presence heartbeat, visibility preference, stale timeout, Realtime updates, and cleanup.
- Presence returns only safe fixed labels and never publishes custom profile status text.

## Commands and results

Passed:

- `npm run friends:ui:smoke`
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

- initial JS: 1533.8 KiB / 1650.0 KiB
- initial CSS: 229.6 KiB / 240.0 KiB
- total assets: 2990.7 KiB / 3500.0 KiB

## Manual and external validation

- Static UI contracts verify all tabs, DM routing, actions, counts, distinct presence styling, filtered suggestions, and cleanup paths.
- Renderer typecheck/build and desktop QA passed in light/dark token-compatible CSS.
- Interactive mouse/keyboard visual inspection was not run in this non-interactive task pass.
- Live two-user Supabase presence timing, visibility, reconnect, and Realtime delivery are **BLOCKED** because an isolated configured Supabase environment and CLI are unavailable. No live pass is claimed.

## Remaining risks

- Hosted presence should be verified with two different authenticated users, including visibility-off and stale heartbeat cases.
- Existing renderer soft bundle targets remain exceeded, but all hard release gates pass.
- Existing unrelated Vite `voiceService` import warning remains unchanged.
