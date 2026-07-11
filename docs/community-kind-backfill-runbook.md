# Existing Community Kind Backfill Runbook

## Purpose

Classify every legacy community as `text` without losing channels, messages, members, roles, invites, ownership, visibility, or audit relationships. The migration is **idempotent**: it updates only rows whose `kind` is null and preserves explicit `radio` and `podcast` values.

## Preflight inventory

Run against a disposable local/staging database first:

```sql
select count(*) as communities_total from public.communities;
select kind, count(*) from public.communities group by kind order by kind;
select count(*) from public.channels;
select count(*) from public.messages;
select count(*) from public.community_members;
select count(*) from public.roles;
select count(*) from public.community_invites;
```

Store only aggregate counts in release evidence. Do not export message bodies, tokens, invite codes, or user secrets.

## Apply and verify

1. Apply `20260711000100_community_kind_domain.sql`.
2. Apply `20260711000200_existing_communities_text_backfill.sql`.
3. Run both migrations a second time in a disposable database; the second run must be a no-op for classified rows.
4. Verify:

```sql
select count(*) as null_kind_count from public.communities where kind is null;
select kind, count(*) from public.communities group by kind order by kind;
select id, name from public.communities where kind = 'text' order by created_at;
```

`null_kind_count` must be zero. Compare pre/post aggregate counts for communities, channels, messages, members, roles, and invites; all must remain unchanged.

## Access regression matrix

- **owner**: can open settings/admin paths and retains full existing rights;
- **admin**: retains assigned management rights without owner-only escalation;
- **moderator**: retains moderation rights and no admin-only rights;
- **member**: retains readable channels and allowed send behavior;
- **visitor**: retains public read-only behavior and cannot see private channels or send.

Run `npm run community:access:smoke`, `npm run supabase:rls:smoke`, and real pgTAP with `npm run supabase:rls:test` when Supabase CLI is available.

## Legacy rollout fallback

During a short app-before-database rollout window, community list reads retry without `kind` only when Postgres/PostgREST reports missing column codes `42703` or `PGRST204`; those legacy rows are interpreted as `text`. Text creation has the same narrow fallback. Radio and Podcast creation never falls back to an old schema because that would lose product identity. Other database errors remain failures.

## Text-channel assumption audit

| Area | Finding | Resolution |
| --- | --- | --- |
| community list/create | selected/inserted every current column | narrow missing-kind fallback for text only |
| `useMvpAppState` | selected a text/fallback channel for every community | actual channel selection is gated by `supportsTextChannels` |
| community factory | generated template channels for every summary | Task 435 gates categories by kind |
| feed/search/profile lookups | resolve channels only for items that carry channel IDs | safe for text content; type-specific routing tasks own Radio/Podcast content |
| admin/channel operations | operate on explicit channel collections | must be entered only from Text community capability paths |

## Rollback and forward-fix

Do not drop the enum or `kind` column after application code depends on it. Database rollback may be unsafe and would erase classification semantics. Prefer a **forward-fix**:

- correct an incorrectly classified row with an audited, authorized update;
- repair deployment order, then rerun the idempotent backfill;
- restore from a verified backup only if broader migration corruption is proven;
- never overwrite valid Radio/Podcast rows with a blanket update.

Before production application, verify a current backup and desktop/server compatibility. The migration itself performs no delete, truncate, cascade, or content rewrite.
