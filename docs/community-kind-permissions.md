# Community Kind Permissions

Picom treats `text`, `radio`, and `podcast` as separate product spaces. A role may be reused across spaces, but a capability is valid only when it belongs to the target community kind.

## Capability matrix

| Kind | Owner/Admin | Moderator | Member | Visitor |
| --- | --- | --- | --- | --- |
| Text | administer channels, send and moderate messages | send and moderate messages | send messages | public read only |
| Radio | host, schedule, manage programs and announcements | listen and moderate listener comments | listen | public station metadata only |
| Podcast | draft, publish, edit, archive, manage series and comments | listen and moderate comments | listen, react, comment | published public metadata only |

Specialized `Radio Host`, `Podcast Publisher`, and `Podcast Editor` roles receive only their explicit capabilities. Role labels do not bypass the community-kind check. Owner and Admin hierarchy is honored only after the expected kind matches.

## Enforcement layers

- `communityPermissions.ts` computes the same kind-scoped decisions used by desktop entry points.
- `communityService.getCommunityKind` and `audioDataSource.ensureCommunityKind` reject incompatible service writes before transport.
- `can_manage_community_kind` and `can_view_community_kind_content` are the canonical database checks.
- Source triggers reject Radio rows outside Radio communities and Podcast rows outside Podcast communities, including trusted/backend writes.
- Scope triggers prevent cross-community channel and Podcast series references.
- Podcast status transitions require explicit draft, publish, or archive capability.
- Storage access remains private and continues through kind-aware episode/session visibility helpers.

Frontend checks are UX only. Supabase RLS and source triggers remain authoritative.

## Validation

Run `npm run community:kind-permissions:smoke`. Run `supabase test db --file supabase/tests/rls/community_kind_permissions.sql` only against an isolated local or staging database. The pgTAP matrix covers Owner, Admin, Moderator, Member, and Visitor for every community kind. Never run fixture tests against production.
