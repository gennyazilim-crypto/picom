# PICOM 30-day deletion stable-window release — aborted preflight

**Observed at:** 2026-09-06T14:17:08Z  
**Status:** `BLOCKED_CLI_REQUIRES_FORBIDDEN_INCLUDE_ALL`

## Release context

- Canonical source: `17e2582db3294edce76303b70cf81bbe20edd6b9`
- Production target: `picom-production` (`cqnsetsmcduraryemhbi`)
- Coordination mode: `SOLO_OPERATOR_STABLE_WINDOW`
- Expected remote history before apply: count `312`, latest `20260906220000`
- Canonical history: `GO_EXACT_RECONCILED`
- Hosted deletion pgTAP: `PASS 41/41`
- Hosted deletion RLS: `GO`
- PITR: `GO`
- Feature flags: `OFF`
- Finalizer schedulers: `OFF`

## Immutable candidate migrations

| Version | File | LF-normalized SHA-256 |
| --- | --- | --- |
| `20260906120000` | `simplified_30_day_deletion.sql` | `6C09430E47183B990D13A4F9D6214AE8738732AAA4A96026CAF146828A819FA5` |
| `20260906130000` | `protect_profile_deletion_lifecycle.sql` | `A3C74397554070FF45C03C609FB0F5D33906CDDA73E885F963757E3AEA1E3138` |

## Stable-window observations

The pre-dry-run production history at `2026-09-06T14:11:50Z` was count `312`,
latest `20260906220000`. The post-dry-run read was also count `312`, latest
`20260906220000`, with no production mutation made during this release window.

The exact reconciled canonical sources for `20260906180000`,
`20260906190000`, `20260906200000`, `20260906210000`, and `20260906220000`
were present. The existing `20260808220000` legacy-provenance exception was
represented only by a temporary comments-only, ignored local compatibility
shim during the CLI check; it was removed before this record was created and
was never committed.

## Fail-closed dry-run result

The official linked Supabase dry-run did **not** produce an executable exact
pending set. It stopped before planning an apply with:

> Found local migration files to be inserted before the last migration on remote database.

It listed only `20260906120000` and `20260906130000`, then required the
`--include-all` option because production already contains later versions
through `20260906220000`.

`--include-all` is forbidden for this release. Therefore the required
`FINAL_DRY_RUN = EXACT_TWO` gate is not satisfied, no release manifest was
sealed, and neither deletion migration was applied. No migration repair,
manual migration-history mutation, reset, or production SQL execution
occurred.

## Required next decision

Establish an approved production migration procedure for legitimately applying
these two earlier-versioned, already-reviewed migrations without violating the
release prohibition on `--include-all`, or explicitly supersede them with a
new forward-only release design. A new stable release window is required after
that decision.
