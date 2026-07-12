# Picom Global Navigation Full MVP QA

Date: 2026-07-12

## Decision

The global authenticated navigation implementation passes every local required gate in this audit. Feed is the normal authenticated landing route, ServerRail is scoped to Communities, User Settings and Community Settings are separate, Help & Support has one primary global entry, and badges/presence use real application state rather than display constants.

This is a local Full MVP navigation PASS. It is not a stable-release certification: protected hosted, physical-device, screen-reader, and pixel-baseline evidence listed in the known-issues document remains outstanding.

## Functional matrix

| Area | Result | Evidence |
| --- | --- | --- |
| Login, registration, onboarding completion, session restore, relaunch | PASS | Authenticated route smoke verifies Feed as the default and preserves validated explicit navigation within a session. |
| Logout and presence shutdown | PASS | Global user card/presence and Supabase realtime presence lifecycle contracts. |
| Feed, DM, Communities, Radio, Podcasts, Events, Bookmarks | PASS | Global registry/shell contract and route handlers. |
| Settings | PASS | Global-only User Settings entry and settings separation contract. |
| Help & Support | PASS | Dedicated global workspace and duplicate-entry smoke. |
| Profile and return navigation | PASS | Existing profile route state remains outside Settings and community management. |
| Community-only ServerRail | PASS | Community workspace slot contract; Radio and Podcast use type-specific workspaces. |
| Owner/Admin/Moderator/Member/Visitor community management | PASS | Community settings destination policy remains permission-aware. |
| Online/Idle/DND/Invisible | PASS | Presence preference/store tests and contradictory-state prevention. |
| Reconnect/resubscribe | PASS | One active friend-presence subscription, generation-safe cleanup, delayed offline fallback, realtime contract. |
| Badges | PASS | Privacy-filtered DM/community counts, realtime-only Radio live state, policy-filtered events, no synthetic Podcast/Bookmark badges. |
| Notification and native deep links | PASS | Auth, block, membership, public access, channel visibility, and community-kind validation before navigation. |
| Wide/compact navigation | PASS | 216 px wide and 72 px compact structural contract. |
| Keyboard and accessibility | PASS | Tab/native activation, Arrow/Home/End focus, Escape focus restoration, `aria-current`, accessible badges, high contrast, reduced motion. |
| Turkish/English labels | PASS | Localization QA contract. |

## Commands and results

All commands below exited with code 0:

- `npm ci`
- `node scripts/global-navigation-full-mvp-qa.mjs`
- `npm run typecheck`
- `npm run presence:accuracy:test`
- `npm run realtime:staging:contract:test`
- `npm run localization:qa:smoke`
- `npm run desktop:display:qa`
- `npm run accessibility:display:smoke`
- `npm run supabase:config:smoke`
- `npm run supabase:smoke`
- `npm run supabase:rls:smoke`
- `npm run supabase:qa`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run visual:regression:contract`
- `npm run e2e:coverage:contract`
- `npm run performance:budget:ci`

## Performance evidence

- Initial JS: 1206.8 KiB, below the 1650 KiB hard cap.
- Initial CSS: 239.9 KiB, below the 240 KiB hard cap.
- Largest JS chunk: 943.3 KiB.
- Largest CSS chunk: 239.9 KiB.
- Total generated assets: 3468.4 KiB, below the 3500 KiB hard cap.
- Generated asset count: 79.

The warning targets remain active and were not raised or bypassed.

## Supabase and realtime evidence

- Supabase client/config contract: PASS.
- Migration integrity: PASS, 188 unique ordered BOM-free migrations.
- Structural RLS scenarios: PASS.
- Supabase API mode regression: PASS.
- Realtime staging two-client contract shape: PASS.
- Real pgTAP execution: BLOCKED because Supabase CLI is unavailable in this environment.
- Protected hosted two-client presence/badge propagation: BLOCKED because staging identities and protected credentials were intentionally not used.

## Regression result

No mobile navigation, native Electron menu, product redesign, direct UI-to-Supabase call, secret exposure, or Discord branding was introduced. The existing Electron security and packaging smoke gates pass.

See [global-navigation-known-issues.md](./global-navigation-known-issues.md) for remaining release evidence.
