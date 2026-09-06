# Canonical 30-day deletion integration

The 30-day deletion lifecycle is integrated on the canonical application
architecture rather than by replaying the divergent source branch.

## Migration

- Version: `20260906120000`
- File: `supabase/migrations/20260906120000_simplified_30_day_deletion.sql`
- SHA-256 (raw and LF-normalized):
  `6C09430E47183B990D13A4F9D6214AE8738732AAA4A96026CAF146828A819FA5`
- The migration is forward-only. It is not scheduled or applied by this
  integration work.

## Lifecycle contract

- A community owner can request deletion, has a 30-day recovery period, and
  can cancel during that period. Pending communities are excluded from
  discovery, joins, invitations, and community Live discovery.
- An account deletion request sends a one-time, hashed email confirmation
  credential with a 24-hour expiry. The 30-day recovery period begins only
  after that credential is redeemed.
- Finalizers are trusted, bounded, retry-safe workers. Their Edge Function
  handlers require both an enabled worker environment flag and a worker secret.
  No scheduler is configured or enabled by this change.

## Canonical UI and localization

- Community deletion is implemented in the current community danger-zone
  surface. It contains no archive reason, community-name typing, or password
  field.
- Account deletion uses the current Account Center routes and shell. The
  account-center catalog currently has English and Turkish; the desktop
  settings catalog retains its existing ten-language architecture.
- `COMMUNITY_30_DAY_DELETION_ENABLED` and
  `ACCOUNT_30_DAY_DELETION_ENABLED` default to `false` until hosted
  certification and a controlled rollout.

## Release boundary

This document is implementation provenance only. Production migration apply,
email delivery, scheduler activation, and finalization certification require
their separate hosted release gates.
