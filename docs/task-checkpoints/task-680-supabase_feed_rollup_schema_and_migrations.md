# Task 680 Checkpoint: Supabase Feed Rollup Schema and Migrations

Status: Complete (structural); hosted apply pending Task 688  
Date: 2026-07-12

## Delivered

- Canonical `feed_items` source metadata with unique source identity, classification, moderation/deletion state, timestamps, and score version.
- Rebuildable `feed_engagement_rollups` with qualified counts, capped components, supporter count, raw score, and version.
- Unique per-user `feed_user_states` for read/save/hide/seen/open timestamps.
- Privacy-minimal `feed_impressions` for session, position, mode, version, `as_of`, shown, and opened timestamps.
- Source/community/channel/author/time/moderation/version/user-state indexes.
- Forced RLS, protected user-owned policies, and source-visibility checks.
- Renderer denial for canonical item/score writes.
- Generated database type snapshot and typed seed/mock parity fixture.
- pgTAP structural contract plus local structural smoke.
- Forward-fix and rebuild notes.

## Validation

- `npm run feed:rollup:schema:smoke`
- `npm run feed:score:v1:smoke`
- `npm run typecheck`

## Evidence state

- Local structural/type checks: required for this checkpoint.
- Local/hosted SQL apply and pgTAP execution: **BLOCKED** until a configured disposable Supabase target is used in Task 688.
- No production, staging, or hosted success is inferred from static checks.
