# Creator Studio Architecture

Canonical shell that unifies Publisher modules under one permission-aware workspace.

## Shell
- Entry: `PublisherCreatorStudioWorkspace`
- Feature flag: `enableCreatorStudio` (production default OFF)
- When flag OFF: falls back to legacy `PublisherDashboardWorkspace` (parity preserved)
- Live stream control room remains `CreatorStudioWorkspace` (session-scoped), linked as Content/Live Control when active

## Context
Server RPC `get_my_publisher_studio_context` / `bootstrap_my_publisher_studio`:
- Resolves publisher from badge ownership or ACTIVE team membership
- Returns effective permissions for UI only; mutations re-check server-side

## Modules
Overview readiness reflects real Task27–32 blockers (not fake zeros).
Child feature flags remain authoritative for Streams/Chat/Analytics/Media/Earnings.

## Evidence
`docs/audit/evidence/creator-studio-unification-20260809T184359Z/`
