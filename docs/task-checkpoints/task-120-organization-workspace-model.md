# Task 120 Checkpoint: Organization/Workspace Model

## Result

Designed an additive future enterprise hierarchy: Organization -> Workspace -> Community. No database migration or runtime behavior was changed because the current schema has no organization/workspace foundation.

## Key decisions

- Organization is the tenant/security/legal/billing boundary.
- Workspace is the subdivision, policy inheritance, and delegated-admin boundary.
- Community remains the existing user-facing chat and moderation boundary.
- Existing consumer communities remain independent (`workspace_id` future-null) unless explicitly adopted.
- Organization/workspace roles are separate from community roles.
- Billing owner is a non-authorizing placeholder.
- SSO domain supports discovery only; provider plus active membership/RLS authorizes access.
- SCIM deprovisions enterprise access without deleting unrelated consumer identity/data.

## Safety and migration

- Defined tenant-scoped RLS for database, realtime, Storage, LiveKit, search, and exports.
- Defined stricter-policy inheritance and non-destructive lifecycle behavior.
- Proposed a staged nullable migration with consumer regression and cross-tenant tests before activation.

## Validation

- Confirmed current migrations do not contain organization/workspace tables or foreign keys.
- Documentation-only; existing Picom flows remain unchanged.
- `npm run typecheck`
- `npm run mock:smoke`

