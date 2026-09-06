# Profile deletion lifecycle RLS hardening

## Scope

`20260906130000_protect_profile_deletion_lifecycle.sql` closes a direct-write
gap in the existing owner-only `profiles` update policy. That policy remains
responsible for normal profile editing; the new trigger prevents ordinary
authenticated callers from changing server-authoritative account deletion
lifecycle fields.

LF-normalized SHA-256:
`A3C74397554070FF45C03C609FB0F5D33906CDDA73E885F963757E3AEA1E3138`

## Protected fields

- `profiles.is_deleted`
- `profiles.deleted_at`
- `profiles.deletion_requested_at`

The guard allows the trusted `service_role` finalizer path and has no
`SECURITY DEFINER` bypass. It does not change ordinary self-service fields
such as display name, avatar, or bio.

## Non-production certification

Target: `picom-community-creation-validation-20260831` (`ighyekrjrxnlxyoyhhzj`)

The migration was applied through the linked Supabase workflow. The hosted
pgTAP deletion suite passed 41 assertions, including direct timestamp and null
transition attempts, generic profile RPC payload rejection, foreign-row RLS,
and the trusted finalizer path. This is non-production evidence only; feature
flags and finalizer schedulers remain off.

## Production boundary

Production must receive the existing deletion lifecycle migration
`20260906120000_simplified_30_day_deletion.sql` before this hardening migration,
in the exact sealed order. No migration history repair or manual history change
is permitted.
