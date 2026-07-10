# Supabase Production Migration Dry Run

## Purpose

Prove Picom migrations can be applied to a disposable or staging Supabase project before production. This workflow never uses production credentials and never treats a successful dry run as production approval.

Supabase remote migration commands require a linked project. Edge Function secrets must be configured in the Supabase secret store, never in renderer variables or committed files. See the official [Supabase CLI reference](https://supabase.com/docs/reference/cli/v0/supabase-db-remote-commit) and [Edge Function secrets guidance](https://supabase.com/docs/guides/functions/secrets).

## Preconditions

- Supabase CLI installed and authenticated using the operator's local credential store.
- A disposable/staging project with no production user data.
- Staging project reference recorded in the approved operations channel.
- A verified staging backup or a disposable-project rebuild plan.
- Repository checked out at the exact release commit.
- No unreviewed migration files or migration timestamp collisions.

Never pass database passwords, service-role keys, LiveKit secrets, or provider credentials on a committed command line or write them into the repository.

## Automated dry-run helper

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/supabase-migration-dry-run.ps1 `
  -ProjectRef "<staging-project-ref>" `
  -ConfirmStaging
```

The helper:

1. Rejects missing staging confirmation and known production project references.
2. Verifies the Supabase CLI and expected migration directory.
3. Links the local repository to the staging project.
4. Lists migration state and runs `supabase db push --dry-run`.
5. Does not apply changes unless `-Apply` is explicitly supplied.

After review and backup approval, apply to staging only:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/supabase-migration-dry-run.ps1 `
  -ProjectRef "<staging-project-ref>" `
  -ConfirmStaging `
  -Apply
```

## Migration checklist

### Schema

- All migrations `00100` through the release migration are listed in order.
- Tables, constraints, foreign keys, indexes, functions, triggers, and grants exist.
- No migration performs an undocumented destructive rewrite.
- `npm run supabase:smoke` passes before and after the staging push.

### RLS

- Every user/community/message/DM/integration/admin table has RLS enabled where required.
- Anonymous access is limited to explicitly public community/channel data.
- Negative role tests pass for visitors, members, moderators, admins, owners, and app admins.
- Run `npm run supabase:rls:test` against the disposable local stack and execute the staging two-account matrix.

### Storage

- `message-attachments` is private.
- Upload, read, and delete policies match message/channel visibility.
- Private-channel objects cannot be fetched by visitors or unrelated members.
- File size/MIME checks are repeated by trusted server validation.

### Realtime

- `messages`, `direct_messages`, `direct_message_reactions`, and approved realtime tables appear in `supabase_realtime`.
- Two clients receive insert/update/delete once and reconcile optimistic IDs.
- Reconnect does not duplicate messages or resurrect deleted state.

### Edge Functions

Inventory:

- `accept-invite`
- `client-config`
- `health`
- `livekit-token`
- `moderation-helper`
- `notification-fanout`
- `validate-file`
- `webhook-message` (disabled until production approval)

Required provider-specific secret names include `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`. Supabase-provided runtime values remain managed by Supabase. Optional email/provider values must remain disabled unless approved. Use `supabase secrets list` to verify names only; do not export values into logs.

## Manual verification queries

Run through the staging SQL editor using an approved operator account.

```sql
-- Applied migration history
select version, name
from supabase_migrations.schema_migrations
order by version;

-- RLS state for public tables
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- Policy inventory
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- Realtime publication
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;

-- Storage bucket safety
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

-- Critical trigger inventory
select event_object_schema, event_object_table, trigger_name
from information_schema.triggers
where event_object_schema = 'public'
order by event_object_table, trigger_name;
```

## Functional staging checks

1. Register/login and restore a session.
2. Create a community/channel and send/edit/delete a message.
3. Verify visitor public read and denied write.
4. Verify private channel denial.
5. Exercise DM membership isolation with two accounts.
6. Upload a valid image and reject invalid MIME/signature/size.
7. Accept/reject/revoke/expire an invite.
8. Review reports and audit logs only with permitted roles.
9. Join LiveKit voice using a function-issued token.
10. Verify disabled webhook/bot provider paths fail safely.

## Backup and rollback

- Take and verify a backup before any non-disposable staging or production migration.
- SQL migrations are forward operations. A database rollback may be unsafe or impossible after data transformation.
- Prefer a corrective forward migration. Restore only when the incident commander approves the data-loss window and backup integrity is proven.
- Desktop client/server compatibility must be checked before rolling backend schema backward.
- Do not delete migration history rows to simulate rollback.

## Approval record

Record release commit, staging project ref, backup identifier, dry-run output summary, migration diff approval, RLS results, functional smoke evidence, operator, reviewer, timestamp, and go/no-go decision. Never record secrets.
