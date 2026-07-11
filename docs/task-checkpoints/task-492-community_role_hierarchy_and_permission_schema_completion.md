# Task 492 Checkpoint: Community Role Hierarchy and Permission Schema Completion

## Completed

- Added explicit built-in role identity, default-role state, and permission projection versioning without replacing existing role IDs or memberships.
- Added a canonical permission registry covering common, Text, Voice, Radio, and Podcast actions.
- Added normalized role grants plus category, channel, Radio program, and Podcast series role overrides.
- Added owner/default-role mutation guards, cross-community role validation, safe self-join assignment, strict lower-role management, and permission delegation checks.
- Added deny-by-default SQL and TypeScript evaluators with matching override precedence.
- Routed community-kind authorization through the canonical SQL evaluator.
- Added RLS, least-privilege grants, indexes, pgTAP structure, frontend parity smoke coverage, and generated database type contracts.

## Compatibility

`roles.permissions` remains synchronized as a version 2 compatibility projection. Existing community, Radio, Podcast, and role assignment flows keep their IDs and RPC signature. Custom roles no longer become Admin or Moderator merely because of a high position; they require explicit permissions.

## Blocked external evidence

Hosted pgTAP and real Supabase RLS execution require a configured staging project and Supabase CLI. No hosted pass is claimed until that environment is available.
