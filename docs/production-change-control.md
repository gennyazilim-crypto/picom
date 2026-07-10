# Production Change Control

Status: **Draft process - owners unassigned**

## Normal changes

Every production change requires a ticket/change record, accountable owner, purpose, affected systems, exact non-secret configuration delta, security/data impact, test evidence, maintenance window, rollback/forward-fix plan, and approver. Frozen release values may change only through a new reviewed record and artifact/version when client bytes change.

## Emergency override

Incident leadership may use documented kill switches or rollback values for a confirmed security, availability, or data-integrity incident. The operator must preserve redacted evidence, avoid exposing credentials, record who authorized the action, communicate user impact, and complete retrospective review.

## Secret handling

Only secret names, owners, storage locations, rotation dates, and recovery contacts are recorded. Values remain in protected stores. Renderer/Vite configuration may contain only public Supabase/LiveKit/status values; database, service-role, signing, notary, OAuth, and provider secrets remain server/CI-only.

## Freeze exit

Stable release cannot exit freeze until named owners approve the final version/channel/source commit, hosted endpoints/regions, buckets, Edge versions, feature flags, legal versions, support/status URLs, retention/backups, platform signing, artifact checksums, and rollback values.

## Task 413 activation status

This process is documented but cannot activate until real approvers/operators are assigned. No agent-generated identity is an approval.