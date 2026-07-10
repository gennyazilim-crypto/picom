# Task 431 - Verified Account Consistency Fix

Date: 2026-07-11

## Scope

Centralized Picom's verified identity model and corrected compact, medium, and profile visual behavior without changing verification approval security or redesigning existing views.

## Implemented

- Canonical status-bearing verification model.
- Approved-only public badge guard.
- Profile-only verified aura.
- Correct white-check badge glyph.
- Hover/focus-only custom tooltip with Escape and blur closure.
- Name-adjacent badges in DM list/header/messages/details, MemberSidebar, Mention Feed, Popular/Following, Community Chat messages, profile popover, and official community header.
- DM active row and keyboard focus separated from verification.
- Presence dot remains semantically separate.
- DM-only `participantVerified` boolean removed.
- Verification smoke contract expanded.

## Security

No Supabase migration, approval RPC, RLS policy, or admin authorization rule was weakened. Pending, rejected, revoked, missing, role-derived, or text-derived states do not render public verification.

## Validation

Required commands:

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run verification:badges:smoke`
- `npm run visual:regression:contract`
- `npm run performance:budget:ci`

All commands passed from a clean detached worktree based on `9ef28dfb6669cad55382647278e1974712a57f68` with only Task 431 files overlaid:

| Command | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm run verification:badges:smoke` | PASS |
| `npm run mock:smoke` | PASS |
| `npm run build` | PASS |
| `npm run qa:smoke` | PASS |
| `npm run visual:regression:contract` | PASS |
| `npm run performance:budget:ci` | PASS |

Performance evidence: total assets 2761.3 KiB, largest JS chunk 1401.0 KiB, largest CSS chunk 215.6 KiB, 29 generated assets.

Automated contracts cover the model, approved-only rendering, profile-only aura, DM boolean removal, tooltip behavior, integration markers, build, and bundle limits. A live visual interaction pass remains appropriate when the renderer is next opened; no manual UI result is fabricated here.
