# Task 429 - Database Integrity Constraints Audit

## Summary

Audited Picom's Supabase/Postgres integrity constraints and documented relation, uniqueness, validation, and deletion behavior for active MVP tables.

## Completed

- Added `docs/database-integrity.md`.
- Documented current protections for:
  - users/profiles and sessions
  - communities and owners
  - community members
  - roles
  - channel categories and channels
  - messages and sequences
  - attachments
  - reactions
  - read states
- Documented future constraints for invites, bans, audit logs, notifications, reports, abuse events, and account activity.
- Added `database:integrity:smoke` to check key migration constraints and the audit doc.

## Decision

No database migration was added. The current MVP schema already contains critical integrity guards, and placeholder tables should not receive speculative constraints until their schemas are active.

## Validation

- `npm run database:integrity:smoke`
- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run build`

## Remaining gaps

- Supabase CLI is still required for a full local migration reset and SQL integrity execution test.
- Invite, ban, audit log, notification, report, abuse event, and account activity production tables remain future work.

