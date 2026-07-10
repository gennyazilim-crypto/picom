# Production data seeding policy

## Production seed default: empty

Picom production does not seed users, passwords, sessions, communities, memberships, messages, attachments,
reactions, invites, reports, audit events, notifications, or demo content. `supabase/seed.sql` contains known
synthetic local credentials and is allowed only for disposable local `supabase db reset` workflows. Never use
remote `--include-seed`, paste local seed SQL into Dashboard, or copy a development database into production.

Staging may use separately managed synthetic accounts/data, but credentials stay in an approved secret
runner and data must be clearly isolated, reproducible, non-personal, and removable. Production smoke users
are created through approved Auth/operator workflows, never from local seed files.

## What belongs in migrations instead

Versioned, non-user data required by application code belongs in reviewed SQL migrations: enum/check
constraints, functions, RLS policies, triggers, bucket definitions, static system capability identifiers, and
schema-level defaults. Migrations must not create known-login accounts or realistic user content. A change to
production reference data needs normal backup, review, staging, compatibility, and rollback/forward-fix gates.

## Community-scoped defaults

Initial roles/categories are tenant data created when an authenticated user creates a community, not global
production seed data. They must be created inside the same database transaction as the community and owner
membership so partial state cannot exist.

Canonical role template:

| Role | Purpose | Default notes |
| --- | --- | --- |
| Owner | Creator/ownership authority | Exactly one owner assignment; never granted by self-service seed |
| Admin | Delegated administration | High privilege but cannot transfer ownership by default |
| Moderator | Message/member moderation | No owner/admin role-management escalation |
| Member | Normal participant | `is_default=true` for join flows |
| Guest | Restricted/read-oriented participant | Lowest level; no private/send privilege unless explicitly granted |

Canonical category template, when the selected community template requests it:

1. Information
2. Channels
3. Music & Bots
4. General
5. Work Space

Community templates may omit/rename optional categories before creation. After creation, rerunning default
creation must never overwrite owner customization, role permissions, category names/order, or channel data.

## Idempotency and transaction rules

- Enforce unique `(community_id, role_name)` and category identity/position constraints where appropriate.
- Use deterministic template keys and `insert ... on conflict do nothing` for retry-safe defaults.
- Do not use broad `on conflict do update` that could overwrite customized permissions or names.
- Create community, Owner role, owner membership, Member default role, requested categories/channels, and
  audit event in one transaction/RPC; emit Realtime/UI success only after commit.
- Repeated idempotency key returns the original result rather than duplicating defaults.
- Any failure rolls back the whole operation; cleanup scripts do not guess at partial ownership.
- RLS/backend permissions enforce creation; renderer checks are UX only.

The current frontend community service does not yet prove this complete transactional server RPC. Production
community creation remains blocked until the database function and hosted concurrency/idempotency test are
implemented. Do not compensate by running a production seed.

## Admin bootstrap is separate

App-level admin is not a community role and is never seeded. Follow `docs/admin-user-bootstrap.md`: create or
invite a real operator through Supabase Auth, grant app-admin authorization through a restricted server-only
process/table, require MFA/least privilege where available, and append a redacted audit event. Never accept,
store, or log a raw password in Picom maintenance scripts. Community Owner/Admin never implies app-admin.

## Deployment and review gates

Before a production migration/deploy:

- Confirm command does not include local seed or `--include-seed`.
- Scan candidate SQL for `auth.users`, known `@picom.local` addresses, plaintext/dev passwords, fixed synthetic
  user IDs, demo messages, and bulk user content.
- Confirm production database starts/continues with real operator/user-created data only.
- Verify community default creation in isolated staging with retries/concurrent requests and transaction
  rollback injection; expect one community and one set of defaults.
- Verify Owner/Admin/Moderator/Member/Guest permissions and default category ordering through RLS.
- Confirm admin bootstrap and synthetic smoke account lifecycle have separate approval/evidence.

Any development account/password or duplicate/partial community defaults in production is a release blocker
and security incident candidate. Stop rollout, revoke affected accounts/sessions, preserve redacted evidence,
and use an approved corrective migration/cleanup plan rather than ad-hoc deletion.
