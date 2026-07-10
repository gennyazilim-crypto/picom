# Data residency implementation plan

## Status

**Single-region, planning only.** Picom does not route, replicate, migrate, or guarantee residency by user/community/organization. No region selector, endpoint map, tenant router, cross-region replication, migration worker, or provider credential is introduced by this plan.

Residency claims require legal/customer requirements, accepted tenant model, provider contracts, operational ownership, backup/restore evidence, incident handling, and staged migration proof.

## Region unit

Preferred future assignment unit:

- consumer community: immutable home region;
- enterprise organization: approved home region inherited by managed workspaces/communities unless a separately approved multi-region organization model exists;
- direct-message conversation: explicit region selected by approved participant/account policy, not inferred on every request;
- account/auth identity: global or regional only after legal/provider review.

Region assignment is server-authoritative and cannot be selected by renderer flags. Moving a populated resource is an orchestrated migration, not an update to a text column.

## Strategy options

### A. Supabase project per region (recommended first evaluation)

Each region has its own Supabase Auth/Postgres/Storage/Realtime/Functions environment, migrations, keys, backups, monitoring, and incident ownership.

Benefits:

- clearer data-plane isolation and provider-managed operations;
- Storage/Realtime aligned with database region;
- lower self-host operational burden.

Costs/risks:

- identity/session and cross-region account lookup complexity;
- migration/config/RLS drift across projects;
- no cross-project SQL joins or simple global uniqueness;
- more secrets, environments, backups, monitoring, release coordination;
- cross-region DM/search/notifications/support/export need explicit designs.

### B. Self-hosted Supabase-compatible stack per region

Evaluate only when contractual/regulatory/control requirements cannot be met by managed projects and Picom can staff database, Auth, Realtime, Storage, upgrades, security patching, backup, restore, monitoring, and on-call operations.

Benefits: placement/network/key/upgrade control. Risks: much larger security/reliability burden, version drift, unsupported assumptions, capacity planning, and restore responsibility. Self-hosting is not automatically more compliant.

### C. Single global project with logical region fields

Useful only as a transitional metadata step. It does not provide physical residency and must never be marketed as such. RLS tags cannot control where provider infrastructure/backups store bytes.

## Regional service bundle

Every supported region needs a tested bundle:

- Postgres/RLS and schema migrations;
- Auth/session behavior or approved global identity broker;
- private object storage, signed URL service, thumbnails, quarantine/scanning;
- Realtime and presence;
- Edge/API/background jobs;
- LiveKit media region and token service;
- encrypted backups and restore environment;
- logs/metrics/audit/export/retention processing;
- outbound email/webhook/notification provider handling.

All components carry a stable region code in safe operational metadata. Secrets are regional and never sent to Electron.

## Object storage

- Attachments, thumbnails, quarantine objects, exports, and preservation artifacts stay in the owning data region.
- Storage path is derived from authorized tenant/community/channel context; it is not a cross-region URL supplied by the client.
- Signed URLs are short-lived and generated after regional access revalidation.
- CDN caching for private content must honor region/legal policy and prevent unintended edge persistence.
- Scanning/thumbnail processors and temporary files execute in-region unless approved otherwise.
- Orphan cleanup, retention, legal hold, backups, and restore reconciliation are regional.

## Realtime and LiveKit

- Desktop obtains an allowlisted regional connection descriptor from trusted control plane after authentication/authorization.
- Realtime joins only the project owning the community/channel; RLS remains authoritative.
- Presence is region-scoped until a privacy-reviewed global presence aggregator exists.
- LiveKit room/token region follows approved community/organization/media policy and minimizes metadata.
- Media routing may differ from stored-data residency and must be disclosed/tested; no recording by default.
- Migration cutover disconnect/reconnect is versioned and cannot let old clients join the wrong region.

## Control plane

A minimal trusted global control plane may store only routing/lifecycle metadata:

- stable resource/organization ID;
- home region and routing version;
- migration state and cutover epoch;
- entitlement/lifecycle status;
- safe endpoint identifiers, not secrets;
- append-only routing/migration audit evidence.

It must not become a shadow copy of profiles, messages, memberships, attachments, or audit content. Every data-plane request rechecks tenant/resource authorization in the regional backend.

## Migration sequence

1. Inventory all data flows, providers, backups, logs, temporary files, exports, support access, and subprocessors.
2. Approve region codes, legal claims, service bundle, control-plane metadata, RTO/RPO, and ownership.
3. Add dormant region metadata with no routing change; backfill current primary region.
4. Provision a second staging region and prove identical migrations/RLS/config without secrets in repo.
5. Build migration dry-run inventory, compatibility checks, checksums, private object copy, and rollback plan.
6. Migrate synthetic then internal tenant: freeze writes, final delta, verify counts/checksums/RLS/storage, atomically switch routing epoch, reconnect realtime, monitor.
7. Keep source read-only for approved rollback window, then disposition under retention/legal policy.
8. Pilot one low-risk customer after security/legal/operations approval; expand gradually.

## Migration risks

- lost/duplicate/out-of-order messages or reactions;
- stale client routes and sessions;
- cross-region private-channel or tenant leak;
- missing/corrupted attachments, thumbnails, quarantine state;
- signed URLs/CDN caches pointing to source;
- Realtime/voice split-brain and duplicate presence;
- search, notifications, jobs, exports, retention, deletion, legal hold, audit gaps;
- sequence/idempotency/unique-identity collision;
- backup/restore or data-rights inconsistency;
- migration rollback after new writes.

Mitigate with write freeze or versioned dual-read-only transition, idempotency, immutable routing epoch, per-table/object checksums, bounded cutover, explicit client compatibility, source retention, and tested forward repair. Avoid unreviewed dual-write.

## Desktop compatibility

- Remote config/control plane may return public regional endpoints and routing version only.
- Current client version is checked before migration/cutover.
- Auth tokens stay in centralized secure session handling and are never copied into region settings.
- Deep links resolve IDs through trusted routing, then regional authorization.
- Offline queue actions include stable resource IDs/idempotency and receive explicit migrated/retry errors.
- Region is not a normal end-user toggle; unsupported routes fail safely without private metadata.

## Required tests

- two-region cross-tenant/RLS/storage/realtime negative tests;
- migration count/checksum/object-integrity and idempotent retry;
- concurrent writes/freeze/cutover/rollback and stale-client routing;
- Auth refresh/revoke and same-email identity behavior;
- private attachment signed URL/CDN expiry;
- LiveKit region, reconnect, and no-recording guarantees;
- backup restore plus post-restore deletion/hold/session reconciliation in each region;
- search/notification/export/audit/retention/deletion correctness;
- region outage and control-plane degradation.

## Approval gates

- documented legal/customer residency requirements and claims;
- provider region/DPA/subprocessor/backup/log/media evidence;
- accepted tenant and identity architecture;
- funded regional operations, monitoring, on-call, backup/restore and incident response;
- staging certification and independent security/privacy review;
- desktop compatibility, migration and rollback runbooks;
- customer communication/support and data-rights process.

Until these gates pass, the application remains single-region and no residency guarantee is made.
