# Community role assignment

The Community Admin Panel Members section exposes a compact role selector only when `canAssignCommunityRole` permits the actor/target/new-role combination. Owner accounts and the Owner role are never changed here; ownership transfer is a separate destructive workflow.

Owners may assign any non-owner role to non-owner members. Admins may manage only members below their own role level and may assign only roles below their own level. They cannot modify themselves, another admin, or an owner through equal/higher role assignment.

`assign_community_member_role` repeats these rules in PostgreSQL, locks the target membership, validates all records belong to the community, updates the role, and appends a redacted `role_change` audit entry. Frontend hiding is UX only; the RPC is the authority.

Mock mode uses the same TypeScript hierarchy helper and updates local app state. Hosted RLS/concurrency checks require an applied Supabase migration and are not claimed by the static repository test.
