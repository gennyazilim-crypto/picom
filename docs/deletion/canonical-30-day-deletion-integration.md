# Canonical account-deletion integration and immediate community deletion

The account 30-day lifecycle is integrated on the canonical application
architecture rather than by replaying the divergent source branch. Community
deletion is a separate immediate, irreversible owner action.

## Migration

- Version: `20260906120000`
- File: `supabase/migrations/20260906120000_simplified_30_day_deletion.sql`
- SHA-256 (raw and LF-normalized):
  `6C09430E47183B990D13A4F9D6214AE8738732AAA4A96026CAF146828A819FA5`
- The migration is forward-only. It is not scheduled or applied by this
  integration work.
- Version: `20260906230000`
- File: `supabase/migrations/20260906230000_immediate_community_deletion.sql`
- This forward migration retires the community recovery RPCs and adds the
  owner-scoped immediate deletion RPC. It does not alter the account lifecycle.

## Lifecycle contract

- A community owner can permanently delete a community after one warning
  dialog. The community has no recovery period, no restore action and no
  community finalizer.
- An account deletion request sends a one-time, hashed email confirmation
  credential with a 24-hour expiry. The 30-day recovery period begins only
  after that credential is redeemed.
- The account finalizer remains a trusted, bounded, retry-safe worker. Its
  handler requires both an enabled worker environment flag and a worker secret.
  No account scheduler is configured or enabled by this change.

## Canonical UI and localization

- Community deletion is implemented in the current community danger-zone
  surface. It contains one irreversible warning, no archive reason,
  community-name typing, password field, countdown or recovery UI.
- Account deletion uses the current Account Center routes and shell. The
  account-center catalog currently has English and Turkish; the desktop
  settings catalog retains its existing ten-language architecture.
- `COMMUNITY_IMMEDIATE_DELETION_ENABLED` and
  `ACCOUNT_30_DAY_DELETION_ENABLED` default to `false` until hosted
  certification and a controlled rollout. The old
  `COMMUNITY_30_DAY_DELETION_ENABLED` key is deprecated compatibility input
  and does not enable the new UI.

## Release boundary

This document is implementation provenance only. Production migration apply,
email delivery, scheduler activation, and finalization certification require
their separate hosted release gates.
