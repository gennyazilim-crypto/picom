# Community Role Management

The Community Management Center > Roles page is the desktop role editor for Picom Full MVP. It uses the canonical registry introduced by Task 492 and never calls Supabase from React.

## Capabilities

- Create custom roles with a name, Picom color token or custom hex color, optional approved icon, and hierarchy level.
- Rename, recolor, change icon, adjust custom hierarchy level, and toggle grouped permissions.
- Duplicate a role into a safely named custom copy.
- Reorder manageable roles with audited up/down operations. Display order is separate from authorization level so visual movement never silently grants power.
- Delete only unassigned custom roles after explicit confirmation.

Permission groups are General, Membership, Text, Voice, Radio, Podcast, Moderation, and Administration. Groups are filtered to the current community kind. Non-owner managers cannot enable a permission they do not possess.

## Security

All hosted mutations use security-definer RPCs with fixed `search_path`, strict actor/target hierarchy checks, canonical permission validation, delegation checks, row locks, and append-only `role_change` audit records. The Owner/default system roles remain protected. Components use `communityRoleManagementService`; direct role-table writes remain revoked.

## Validation

- `npm run community:role-management:smoke`
- `npm run community:role-permissions:smoke`
- `npm run community:role-assignment:test`
- `npm run typecheck`

Hosted RPC and RLS execution requires a configured Supabase staging project and remains blocked when the CLI/environment is unavailable.
