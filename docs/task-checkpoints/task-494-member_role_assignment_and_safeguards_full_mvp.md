# Task 494 Checkpoint: Member Role Assignment and Safeguards Full MVP

## Completed

- Added a canonical multi-role membership table while preserving `community_members.role_id` as the primary compatibility projection.
- Replaced the single select/apply control with a single-member role dialog, assigned-role chips, available-role safeguards, and grouped effective permission summary.
- Added atomic assignment RPC checks for self escalation, Owner removal, lower/equal hierarchy, permission delegation, active bans, deleted/left members, duplicates, and empty role sets.
- Added append-only actor/target/old-role/new-role audit evidence.
- Added role-link integrity, primary-role synchronization, assigned-role delete prevention, indexes, RLS, and Realtime publication.
- Updated frontend effective access, scoped override aggregation, role deletion checks, member loading, local state, and realtime refresh for multiple roles.

## Blocked external evidence

Hosted Supabase RPC, pgTAP, and two-client realtime validation remain blocked until a staging project and Supabase CLI are configured. Static and mock tests do not claim hosted success.
