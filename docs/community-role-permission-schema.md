# Community Role and Permission Schema

## Canonical model

Picom uses one permission registry in `community_permission_definitions`, one normalized grant table in `community_role_permissions`, and one resource override table in `community_permission_overrides`. The legacy `roles.permissions` JSON object remains a synchronized compatibility projection while older RLS paths migrate to `effective_community_permission`.

Role `level` is the canonical hierarchy position. Higher positions manage only lower positions. Built-in identities use `roles.system_key`: Owner is exactly 100, Admin is 80-99, Moderator is 60-79, and Member is 0-59. Custom roles may use any non-owner position from 0-99 and receive only explicit grants.

## Invariants

- A community has at most one Owner, Admin, Moderator, and default Member system role.
- The Owner role cannot be renamed, moved below 100, assigned to a non-owner, or deleted while the community exists.
- The default Member role cannot be deleted while the community exists.
- A self-joining user can receive only the default role.
- A role and membership must belong to the same community.
- Owners manage any non-owner role. Other managers need `manageRoles` and must be strictly above both the current and requested target roles.
- A non-owner cannot grant a permission they do not possess.
- Unknown permission keys, cross-kind permissions, malformed scopes, and cross-community scopes deny.

## Permission families

- Common: community, channel/category, role, member, moderation, invite, insight, audit, and override management.
- Text: channel view, send, announcement, attachment, reaction, and private-channel access.
- Voice: join, speak, and screen share.
- Radio: view/listen, host, schedule, programs, hosts, announcements, and comment moderation.
- Podcast: view/listen, draft, publish, metadata edit, archive, episode moderation, series, comments, and reactions.

## Scoped overrides

Approved scopes are category, channel, Radio program, and Podcast series. Overrides are role-based and use `allow` or `deny`; removing a row restores inheritance. A channel first inherits its category override and then its channel override. A same-scope deny wins in the renderer helper. Owner access is evaluated only after the resource is proven to belong to the community.

All override mutations use `set_community_permission_override`. Normal clients cannot write grant or override tables directly. Resource deletion removes matching override rows while audit records remain separate.

## RLS and compatibility

`effective_community_permission` is the canonical deny-by-default server evaluator. `has_community_permission` is its community-scope wrapper. `can_manage_community_kind` now delegates to the canonical evaluator, so Radio and Podcast RLS use the same normalized grants as frontend helpers.

The normalized grant trigger keeps `roles.permissions` synchronized for older policies. New security-sensitive policies should use the evaluator rather than role names, level thresholds, or client capability arrays.

## Validation

- `npm run community:role-permissions:smoke`
- `npm run community:role-assignment:test`
- `npm run community:kind-permissions:smoke`
- `npm run supabase:rls:smoke`

The pgTAP contract is `supabase/tests/rls/community_role_permission_schema.sql`. Hosted execution remains blocked until a configured Supabase staging project and CLI are available; static migration/RLS contracts do not claim hosted success.
