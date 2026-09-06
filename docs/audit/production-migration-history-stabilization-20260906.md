# Production migration history stabilization

## Scope

This audit reconciles production migrations discovered after the earlier
Account Center reconciliation. The SQL below was recovered from the production
`supabase_migrations.schema_migrations.statements` arrays by the official
Supabase CLI in an isolated disposable worktree. These are already applied
production migrations. Adding their exact source to canonical history is not
authorization to execute them again.

| Version | Remote name | Statements | LF SHA-256 | Classification |
| --- | --- | ---: | --- | --- |
| `20260906180000` | `root_dashboard_real_mfa_hardening` | 6 | `4F52A1C02719825168805A5E8F730A604E93C59919451E60A2863D9BFE163E88` | `RECOVERED_EXACT` |
| `20260906210000` | `founder_owner_bootstrap` | 3 | `28D150DBBE449E9823810A71575C127D68B81175FF39D27F82664021AB3554C9` | `RECOVERED_EXACT` |
| `20260906220000` | `broadcaster_schedule_read_adapter` | 6 | `5FCFD1D45DA9887E03669DD395EA0591E6E0D2CEBD47E07F57A5F6E3EF5E84FF` | `RECOVERED_EXACT` |

## Production history observations

- Snapshot A: `2026-09-06T13:56:25.499285Z`, count `312`, latest
  `20260906220000`.
- Snapshot B: `2026-09-06T13:57:11.956111Z`, count `312`, latest
  `20260906220000`.
- No version, count, or latest-version change occurred during this bounded
  observation window.
- After the exact-source reconciliation, Snapshot C was
  `2026-09-06T14:05:31.109521Z` and Snapshot D was
  `2026-09-06T14:06:21.910887Z`; both reported count `312` and latest
  `20260906220000`, with the same twelve-version tail.
- The remote rows contain no `created_by` or `idempotency_key` attribution.
- No tracked Git commit or branch contained these three filenames before this
  reconciliation. No active local Supabase migration process or CI workflow
  with a production `db push` step was observed.

## Provenance and purpose

- `20260906180000` is the Root Dashboard MFA and privileged-operation
  hardening migration. A local preparation note existed, but it described the
  migration as not applied; production history is authoritative and proves it
  was applied. The official fetched SQL is retained rather than the divergent
  local candidate.
- `20260906210000` is the founder-owner bootstrap migration. The fetched SQL
  is byte-identical to the local candidate and local bootstrap manifest. It is
  retained only as an applied-history source; this reconciliation does not
  grant roles, badges, or permissions.
- `20260906220000` adds the authenticated, read-only broadcaster schedule
  adapter. The official fetched SQL is retained rather than the divergent
  local candidate.

## Deletion release impact

The recovered SQL does not update `profiles.deleted_at`, `profiles.is_deleted`,
`profiles.deletion_requested_at`, community deletion fields, account deletion
request state, or deletion finalizers. It does not create deletion lifecycle
RLS policies. The Root Dashboard migration has read-only profile and
notification views; the founder bootstrap is a privileged assignment/audit
operation; the broadcaster adapter is an authenticated read RPC.

`DELETION_SCHEMA_IMPACT: COMPATIBLE`

## Safety boundary

No production migration-history row, schema, data, feature flag, scheduler, or
workflow was changed during this reconciliation. A production migration freeze
cannot be marked enforced: no repository-level automatic migration deployment
path was found and remote rows cannot identify the applying actor. Production
release remains blocked until an enforceable cross-operator migration freeze is
established and a fresh history-stability check succeeds.
