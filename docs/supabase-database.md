# Supabase database guide

This guide documents the current Supabase database foundation for Picom, the Windows/Linux/macOS Electron desktop chat app.

## Scope

The database foundation covers the MVP community chat data model:

- Supabase Auth user identity.
- Public profile records.
- Communities.
- Roles and community membership.
- Channel categories.
- Text and voice placeholder channels.
- Messages.
- Message attachments.
- Message reactions.
- Read states.
- Direct conversations, participants, messages, attachments, and reactions.

Advanced roadmap areas such as bots, marketplace discovery, plugins, analytics, and production auto-update are intentionally out of scope for this database foundation.

## Local setup workflow

1. Install Supabase CLI.
2. Configure local environment variables from `.env.example`.
3. Start local Supabase.
4. Run database reset/migrations.
5. Generate TypeScript database types.

Example:

```powershell
supabase start
supabase db reset
npm run supabase:types
npm run typecheck
```

## Migration files

The current schema is built through SQL migrations in `supabase/migrations`:

- `20260704000100_baseline.sql`: baseline MVP tables, indexes, and RLS enablement.
- `20260704000200_profiles_schema.sql`: profile validation and indexes.
- `20260704000300_communities_schema.sql`: community validation and indexes.
- `20260704000400_community_members_schema.sql`: membership role/community integrity.
- `20260704000500_roles_schema.sql`: role validation, color, hierarchy, and permission metadata.
- `20260704000600_channel_categories_schema.sql`: category validation and uniqueness.
- `20260704000700_channels_schema.sql`: channel validation, indexes, and category/community integrity.
- `20260704000800_messages_schema.sql`: message validation, optimistic send id, and channel/community integrity.
- `20260704000900_message_attachments_schema.sql`: attachment metadata hardening and `message_attachments` view.
- `20260704001000_message_reactions_schema.sql`: reaction validation and indexes.
- `20260704001100_read_states_schema.sql`: read marker consistency.
- `20260704001200_chat_query_indexes.sql`: targeted chat query indexes.
- `20260710248000_direct_messages_schema_rls_foundation.sql`: canonical DM participant schema, indexes, helper functions, and participant-only RLS.

## Seed data

`supabase/seed.sql` provides deterministic local development data:

- 3 development auth users.
- Profiles.
- Communities.
- Roles.
- Members.
- Categories.
- Channels.
- Messages.
- Attachment metadata.
- Reactions.
- Read states.

Development credentials are documented in `docs/supabase-seed-data.md` and must never be reused in production.

## Type generation

Run:

```powershell
npm run supabase:types
```

This updates:

- `src/services/supabase/database.types.ts`

The committed placeholder keeps builds stable before Supabase CLI is available. Generated types should be committed after schema changes once local Supabase is available and verified.

## RLS model

All public MVP tables have RLS enabled. Current policies cover profiles, communities, community members, channels, messages, attachments, reactions, and participant-scoped Direct Messages.

See `docs/rls-policies.md` for the current policy matrix, helper functions, security notes, and manual verification steps.

Never bypass RLS from renderer/client code. Privileged operations must use trusted server-side code or Supabase Edge Functions when justified.

## Storage notes

Attachment metadata is stored in Postgres. File bytes should be stored in Supabase Storage later. `storage_path` is an object key, not a local filesystem path.

## Realtime notes

The schema is prepared for Supabase Realtime on chat tables, but publication/policy wiring should be handled in future realtime-specific tasks. Realtime must respect RLS and channel visibility.

## Manual verification checklist

- `supabase db reset` applies migrations and seed data.
- Development users can sign in locally.
- Communities and channels are present.
- Messages load by channel using indexed pagination.
- Attachment metadata joins with messages.
- Reaction counts group by message and emoji.
- Read state markers reject messages from the wrong channel.
- `npm run supabase:types` generates fresh database types.
- `npm run typecheck` passes after generated types are updated.

## Related docs

- `docs/profiles-table-schema.md`
- `docs/communities-table-schema.md`
- `docs/community-members-table-schema.md`
- `docs/roles-table-schema.md`
- `docs/channel-categories-table-schema.md`
- `docs/channels-table-schema.md`
- `docs/messages-table-schema.md`
- `docs/message-attachments-table-schema.md`
- `docs/message-reactions-table-schema.md`
- `docs/read-states-table-schema.md`
- `docs/chat-query-indexes.md`
- `docs/supabase-seed-data.md`
- `docs/supabase-type-generation.md`
- `docs/rls-policies.md`
- `docs/direct-messages-schema-rls.md`
