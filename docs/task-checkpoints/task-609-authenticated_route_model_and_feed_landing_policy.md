# Task 609 checkpoint: Authenticated route model and Feed landing policy

## Result

- Added a typed authenticated route inventory covering global workspaces, overlays, profiles, meetings, and voice deep links.
- Defined `AUTHENTICATED_DEFAULT_VIEW` as the single authoritative `feed` startup destination.
- Routed login/session entry, registration entry, onboarding completion, session restoration, and relaunch behavior to Feed.
- Preserved manual navigation after the initial session transition and preserved existing community/channel selection state.
- Added authenticated, parameter-aware deep-link validation with safe legacy aliases and invalid-route rejection.

## Safety

- Existing auth guards and feature permission checks remain unchanged.
- No previous community, DM, Settings, or Support surface is restored automatically.
- No mobile navigation or product feature was introduced.
- No Supabase call was moved into a renderer component.

## Verification

- `node scripts/authenticated-route-feed-landing-smoke.mjs`
- `node scripts/global-navigation-shell-smoke.mjs`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- visual and E2E coverage contracts
- renderer performance budget
