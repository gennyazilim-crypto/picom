# Task 430 - Soft Delete and Restore Policy

## Summary

Documented Picom's safe deletion and restore policy across MVP and future production entities.

## Completed

- Added `docs/deletion-policy.md`.
- Documented hard-delete, soft-delete, archive, and never-delete categories.
- Covered messages, channels, communities, users/profiles, attachments, invites, roles, reports, notifications, and audit logs.
- Documented confirmation requirements and restore requirements.
- Added `deletion:policy:smoke`.

## Decision

No runtime deletion behavior changed. Message soft-delete already exists; community/channel/user restore flows remain placeholders until backend policy, RLS, and audit logging are implemented.

## Validation

- `npm run deletion:policy:smoke`
- `npm run typecheck`
- `npm run build`

## Remaining gaps

- Community/channel soft-delete schema is future work.
- User anonymization and restore APIs are future work.
- Production invite/report/notification/audit log tables are future work.

