# Picom Feed Full MVP QA

## Scope

This report closes the deterministic repository QA pass for the Picom desktop Feed across text messages, Radio, Podcast, stories, following, social actions, companion rail integration, realtime/cache behavior, and privacy boundaries.

## Acceptance Matrix

| Area | Evidence | Result |
| --- | --- | --- |
| Text, Radio, Podcast mention model | Unified mention extraction/model/query/card contracts | PASS |
| Feed and Following tabs | Ranking, persisted tab/filter, and followed-source contracts | PASS |
| Quick filters | Today, week, unread, saved, text, Radio, Podcast | PASS |
| Stories | Header order, compact overflow-safe row, seen state, viewer controls, keyboard, source deep links | PASS |
| Read/save/react/comment | Service persistence, optimistic rollback, authoritative reconciliation, source detail paths | PASS |
| Deep links | Exact text message highlight, Radio session, Podcast episode, community/channel event | PASS |
| Verified identity | Approved verification badge contract | PASS |
| Companion rail | LiveKit voice, friendship/presence, events, global audio player | PASS |
| Realtime/cache | RLS-governed invalidation, dedupe, reconnect refresh, bounded card/page caches | PASS |
| Public/private access | RLS-invoker projections and UI access re-checks | PASS (structural) |
| Blocking/privacy | Blocked-author and inaccessible-channel filtering | PASS (structural) |
| Desktop layout | Visual coverage contract at default/minimum desktop widths and light/dark themes | PASS (contract) |

## Acceptance-Path Fixes Found by QA

- Replaced the text Story console-only highlight marker with exact message highlighting and access re-checks.
- Replaced the Connected Voice screen-share toast placeholder with navigation to the connected room's real screen-share controls.
- Replaced event-details placeholder feedback with exact Radio session or community/channel navigation.
- Updated two stale Story/companion smoke tests after Story viewer and Feed CSS were code-split and voice state moved from mock fields to `VoiceServiceSnapshot`.

## Commands and Results

- `npm run feed:full-mvp:qa` - PASS, 17 feature contracts
- `npm run typecheck` - PASS
- `npm run mock:smoke` - PASS
- `npm run build` - PASS
- `npm run qa:smoke` - PASS
- `npm run performance:budget:ci` - PASS (hard caps)
- `npm run visual:regression:contract` - PASS, 27 desktop scenarios mapped
- `npm run e2e:coverage:contract` - PASS, 16 core flows mapped
- `npm run qa:supabase` - PASS
- `npm run supabase:rls:smoke` - PASS (structural contract)

## External/Interactive Evidence Not Claimed

- Pixel screenshot execution: BLOCKED/PENDING until the Playwright runner and per-platform baselines are activated.
- Electron UI E2E execution: BLOCKED/PENDING until the Playwright/Electron runner is activated.
- Local pgTAP reset run: BLOCKED because Supabase CLI is not installed.
- Hosted two-client Feed insert/update/delete/reconnect test: BLOCKED because protected staging credentials were unavailable.

These blocked checks are not reported as passed. Repository contracts, RLS SQL shape, API regression, and cross-platform production compilation passed.

## Remaining Non-Blocking Warnings

- `voiceService` remains both statically and dynamically imported by existing surfaces.
- Renderer initial JavaScript, initial CSS, and total assets remain above preferred targets but below enforced hard caps.

## Privacy Notes

- UI components do not call Supabase directly.
- Feed projections use security-invoker access checks.
- Diagnostics do not record message bodies, comments, private profile content, tokens, or credentials.
- Blocked users and inaccessible channels are filtered before Feed rendering and re-checked before navigation.
