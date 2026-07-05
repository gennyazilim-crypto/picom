# ADR 0006 - Permissions Model

Status: accepted

## Context

Picom has community roles, private channels, moderation actions, message permissions, and future admin/trust/safety surfaces.

## Decision

Use a layered permissions model:

- Frontend permission helpers improve UX and hide unavailable actions.
- Supabase RLS/backend checks remain the enforcement boundary.
- App-level admin tooling is separate from community admin settings.

## Consequences

- UI-only checks are never sufficient for security.
- Private channel/search/attachment/realtime access must be validated by backend/RLS.
- Placeholder admin/moderation surfaces must stay disabled or development-gated until real authorization exists.
- Permission DTOs should avoid leaking internal or sensitive data.

## Alternatives considered

- Frontend-only permission model: unsafe for production.
- One global admin role for all actions: too coarse and risky.
