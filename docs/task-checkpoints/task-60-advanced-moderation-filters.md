# Task 60 - Advanced Moderation Filters MVP+

## Completed

- Added blocked words, maximum mentions, external-link blocking, and slow-mode settings.
- Enforced the rules before local optimistic sends and recorded successful sends for per-user/channel slow mode.
- Added a Supabase `BEFORE INSERT` moderation trigger so renderer checks are not the authorization boundary.
- Added content-free recent blocked-item metadata to the moderator panel.
- Prepared timeout, kick, ban, and delete-with-reason actions as explicitly disabled placeholders.
- Moderation settings remain owner/admin/moderator restricted through RLS.

## Privacy and audit

- Blocked message bodies are not stored in local moderation activity.
- Moderation status/action metadata uses the redacted logging boundary where available.
- Server-trigger rejection events require future trusted server observability; they are not written from a rolled-back transaction.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

Manual checks cover blocked-word rejection and slow-mode countdown text. Live trigger testing requires Supabase CLI/local Postgres.
