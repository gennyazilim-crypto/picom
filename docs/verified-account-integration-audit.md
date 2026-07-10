# Verified Account Integration Audit

Date: 2026-07-11

## Root causes found

1. `VerifiedAvatarFrame` rendered `VerifiedAvatarRing` and an avatar-overlay badge for every size. This put profile-grade decoration into DM, member, feed, and message contexts.
2. Direct Messages had a second `participantVerified` boolean fallback in addition to the shared helper, allowing DM-only verification drift.
3. Two global CSS blocks styled `.verified-badge-glyph` differently. The older rosette/pseudo-check and newer check geometry combined into a camera-like visual.
4. `VerifiedBadge` exposed both native `title` and a custom tooltip. The duplicate tooltip paths could overlap identity content.
5. Compact badges were attached to the avatar corner occupied conceptually by presence, while active conversation and focus styling were not explicitly separated.
6. Verification was integrated in several surfaces, but mostly through avatar overlays. Name-adjacent markers were missing from DM, member rows, Mention Feed, Community Chat messages, and Popular/Following rows.
7. The repository had active badge records, runtime variants, mock variants, and a DM boolean rather than one status-bearing public summary.

## Corrections

- Added canonical `VerificationStatus`, `VerificationType`, and `VerificationSummary` types.
- Centralized approval, type, label, icon, user, community, persisted-badge, runtime, and mock resolution helpers.
- Removed the DM-only boolean and its fallback.
- Restricted aura and avatar overlay to `size="profile"`.
- Added name-adjacent approved badges throughout existing identity surfaces.
- Replaced the visual glyph with a self-contained white check SVG.
- Consolidated CSS and separated active row, focus-visible, presence, role, and verification states.
- Added approved/staff/official/bot plus pending/rejected/revoked mock fixtures. Non-approved fixtures resolve without a public badge.

## Existing backend boundary

Supabase migrations and review RPC/RLS rules were not changed. The existing approval service remains authoritative in Supabase mode. Runtime review updates now register a full status-bearing summary, so rejected and revoked decisions cannot render a public marker.

## Remaining gap

There is no application-wide rendered search result component in the current project. The future search result UI must consume `getUserVerificationSummary` or `getCommunityVerificationSummary`; it must not add `isVerified`, `verified`, or another display-only boolean.

