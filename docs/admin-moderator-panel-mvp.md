# Picom Community Admin and Moderator Panels

## Scope

These panels manage one Picom community. They are not an app-level enterprise console and do not include billing, SSO/SCIM, bot marketplace, or automated production moderation.

## Access model

| Community access | Admin panel | Moderator panel |
| --- | --- | --- |
| Owner | Full, including Danger Zone | Allowed |
| Admin | Permission-filtered; no owner-only Danger Zone | Allowed when moderation permissions exist |
| Moderator | Not allowed | Permission-filtered |
| Member | Not allowed | Not allowed |
| Visitor | Not allowed | Not allowed |

Frontend gating is a usability layer only. Supabase RLS, service checks, role hierarchy, and database constraints remain authoritative.

## Admin panel

The desktop management center uses left navigation and right content for Overview, Community Settings, Channels, Roles, Members, Invites, Moderation, Audit Log, and Danger Zone.

- `manageCommunity` controls community settings.
- `manageChannels` controls channel tools.
- `manageRoles` controls role tools.
- `manageMembers` controls member tools.
- `createInvites` controls invite creation.
- `moderateMessages` controls moderation tools.
- `viewAuditLog` controls audit visibility.
- Danger Zone is owner-only and destructive operations require their existing confirmation flows.

## Moderator panel

Reports, flagged messages, message moderation, member moderation, and moderation log are filtered by `moderateMessages` or `manageMembers`. Moderators never receive owner/admin community settings merely by opening this panel.

Placeholder report/audit content is explicitly labeled and does not claim that backend events were loaded. Sensitive tokens, passwords, or unrelated private message content must not appear in moderation logs.

## Supabase and RLS follow-up

- Verify role hierarchy and permission JSON cannot be self-escalated.
- Verify moderators cannot grant roles, change community ownership, or access owner-only settings.
- Verify member moderation actions are authorized server-side and audit entries are appended after successful mutations.
- Verify private-channel moderation access follows explicit role permission and does not become community-wide by default.
- Replace polished placeholder report/log sections only after permission-protected staging endpoints or queries exist.

## Beta validation

Test owner, limited admin, moderator, member, and visitor accounts separately. Direct/deep-linked panel access must show a permission-denied state rather than protected content.

