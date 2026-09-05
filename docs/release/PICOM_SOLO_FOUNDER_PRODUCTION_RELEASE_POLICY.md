# PICOM Solo-Founder Production Release Policy

## Status and scope

This temporary policy applies only while PICOM production is operated by one
authorized release operator. It provides a documented, fail-closed release path
for **low-risk forward** database migrations. It does not represent enterprise
two-person governance, and it must be retired when a second authorized release
operator is available.

The policy supplements `docs/production-migration-runbook.md` and
`docs/backup-restore-runbook.md`. For a manifest explicitly marked
`SOLO_FOUNDER_LOW_RISK_FORWARD`, its low-risk gates replace the per-release
restore-drill and two-person gates in those runbooks. All other safety controls
remain mandatory.

## Migration classes

### LOW_RISK_FORWARD

A migration is low risk only when all of the following are true:

- it adds nullable/defaulted columns, additive tables, indexes, functions,
  triggers, or RLS hardening/extensions;
- it contains no table or column drop, `TRUNCATE`, uncontrolled `DELETE`,
  destructive data transformation, irreversible schema conversion, or migration
  history manipulation;
- any trigger or constraint replacement is transactionally safe and preserves
  existing data; and
- the dependent feature can remain disabled after migration.

### HIGH_RISK

The following are high risk and are not eligible for this policy: `DROP`,
destructive `ALTER`, mass `UPDATE`/`DELETE`, data rewrites, irreversible schema
conversions, Auth or security-architecture migrations, financial-ledger
mutations, and major Storage transformations.

High-risk releases require the full production runbook, including a current
isolated restore drill and two-person approval.

## Required low-risk gates

Every scoped low-risk manifest must record all of these as passing before an
apply:

| Gate | Required evidence |
| --- | --- |
| Target identity | Project name, ref, and region independently match the approved target. |
| PITR current | Provider evidence confirms the target's current PITR/backup state and retention. |
| Canonical source | Clean canonical source commit and immutable migration file are identified. |
| Migration integrity | LF-normalized migration SHA matches the sealed manifest. |
| Safety review | Destructive scan passes; dependency order is valid; RLS, grants, and search-path controls are reviewed. |
| Pending set | Official linked CLI dry-run reports exactly the manifest's single pending migration. |
| Quality | Typecheck, build, and focused notification contracts pass for the sealed source. |
| Feature containment | The dependent feature flag is verified OFF before apply. |
| Operator | The current authenticated release operator is identified and recorded without secrets. |

The apply must use the official linked migration workflow. It must stop if the
CLI offers any migration other than the sealed single version. `--include-all`,
`migration repair`, manual migration-history edits, database reset, and ad-hoc
production SQL are forbidden.

## Restore-drill policy

An isolated restore drill remains mandatory before a high-risk migration, a
major GA release, after major backup or infrastructure changes, whenever PITR
health is uncertain, and on the periodic operations schedule. It is not an
immediate blocker for an otherwise qualifying low-risk forward migration.

Until the next successful periodic drill, record:

```text
RESTORE_DRILL_CURRENT: PENDING_PERIODIC_DR_CERTIFICATION
```

This status is not a successful restore claim.

## Two-person policy

For a sealed low-risk solo-founder manifest only:

```text
TWO_PERSON_CONFIRMATION: NOT_REQUIRED_SOLO_FOUNDER_POLICY
```

No second reviewer is fabricated. When PICOM has a second authorized release
operator, the release process must return to `TWO_PERSON_REQUIRED` before the
next policy review.

## Operator boundary and recorded security debt

The authenticated Supabase release principal may be used temporarily for a
qualifying low-risk migration even if its scope is broader than ideal. It must
be described accurately, never as least privilege:

```text
OPERATOR_TYPE: AUTHENTICATED_SOLO_FOUNDER_RELEASE_OPERATOR
OPERATOR_SCOPE: SUPABASE_ORGANIZATION_OWNER_CURRENTLY_BROADER_THAN_IDEAL
SECURITY_DEBT: CREATE_DEDICATED_SCOPED_RELEASE_PRINCIPAL
```

Credentials, access tokens, database passwords, and secret-store values must
never be added to source, manifests, evidence, or command output.

## Legacy production provenance exception

`20260808220000` remains a documented
`LEGACY_REMOTE_PROVENANCE_GAP`. Its original SQL is unavailable, so it must not
be reconstructed, repaired, inserted into hosted migration history, or
committed as a placeholder. Releases must retain the documented exception in
`docs/release/desktop-notifications-legacy-remote-provenance-exceptions.json`.

If the official CLI cannot calculate pending migrations solely because it
requires a local filename for this already-applied remote version, a
comments-only, worktree-local compatibility artifact may be created only for
the dry-run/apply session. It must be verified already applied remotely, never
appear as pending, never execute, and be removed before source is committed or
tagged.

## Current notification release classification

The release manifest for
`20260904100000_production_desktop_notifications.sql` may use this policy only
after a fresh exact-SQL review confirms all of the following:

- forward additive notification columns and indexes only;
- owner-scoped notification state updates only, with no data rewrite;
- transactional replacement of the reviewed notification constraint and
  triggers without data loss;
- RLS/grant hardening and fixed `search_path`; and
- `DESKTOP_NOTIFICATIONS_ENABLED` remains OFF through migration and hosted
  certification.

If any condition is false, stop and use the high-risk release path.

## Manifest, verification, and follow-up

The sealed manifest must state the release mode, source commit, target, region,
migration version and SHA, PITR evidence, pending set, tests, feature-flag
state, operator identity/type/scope, this legacy exception, and all policy
exceptions/debt. Post-apply verification must cover migration history, schema,
functions, triggers, indexes, grants, RLS, Realtime, hosted access/event tests,
and Windows desktop runtime before any controlled feature enablement.

Track these open items until closed:

| ID | Follow-up |
| --- | --- |
| DR-001 | Perform the periodic isolated production restore drill. |
| SEC-DB-001 | Replace the broad Owner release principal with a dedicated scoped migration operator. |
| GOV-001 | Require two-person production approval once a second authorized operator exists. |
