# Member Role Assignment

Picom Full MVP supports multiple roles per community member. `community_members.role_id` remains the highest primary role for compatibility, while `community_member_roles` is the canonical role set.

The Community Management Center > Members page opens a single-member desktop dialog. It shows assigned and available roles, protected roles, hierarchy positions, and an effective permission summary grouped by community kind. Batch assignment is intentionally not included.

## Safeguards

- Owners use the ownership transfer flow and cannot have their Owner role removed here.
- Managers cannot change their own roles.
- An actor cannot manage a member whose highest role is equal or higher.
- An actor cannot assign an equal/higher role or delegate a permission they do not possess.
- Banned, deleted, or concurrently departed members fail safely.
- At least one role is required; the highest assigned role becomes the compatibility primary role.
- Assignment is atomic, row-locked, and emits both the normal audit event and an append-only old/new role-set audit record.

Role-link changes are included in Supabase Realtime. The service coalesces events, reloads the authoritative set, and updates the open management UI. Member loading hydrates all role IDs instead of inferring secondary roles from the primary role.

Hosted RPC/RLS/realtime validation requires configured Supabase staging credentials and CLI; no hosted pass is claimed without them.
