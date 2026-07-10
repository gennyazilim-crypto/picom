# Data Residency Plan

## Status and current limitation

Picom has **no verified production data-residency guarantee**. Repository configuration does not identify an approved production Supabase project region, Storage region, LiveKit media region, backup region, log/crash provider region, or cross-border transfer mechanism.

The current architecture must therefore be treated as:

- one configured Supabase project for Auth, Postgres, Storage, Realtime, and Edge Functions;
- one configured LiveKit deployment/provider endpoint for voice and screen share;
- no client-side region selection or multi-region routing;
- region values maintained in a restricted deployment inventory, not inferred from endpoint text;
- consumer beta planning only until legal, provider, and infrastructure records are approved.

Do not publish a region, residency, localization, GDPR, sovereignty, or “data never leaves” claim based on this plan alone.

## Data inventory by system

| System | Data | Current region evidence | Required production record |
| --- | --- | --- | --- |
| Supabase Auth | identity, sessions, provider metadata | Not recorded in repo | Project ref, chosen region, provider entity/DPA, backup/restore behavior |
| Supabase Postgres | profiles, communities, channels, messages, permissions, audit metadata | Not recorded in repo | Primary region, replicas, PITR/backup region, access owners |
| Supabase Storage | avatars, icons, message attachment objects | Expected project origin, not independently verified | Bucket origin, CDN/cache behavior, deletion/backup plan, private access policy |
| Supabase Realtime | Postgres Changes, typing, presence | Follows configured project/service; not verified | Connection/processing regions, private-channel auth, logs/retention |
| Edge Functions | token/validation/config operations | Invocation may differ from database region | Execution region strategy, DB/Storage locality, logs, secrets |
| LiveKit | signaling, voice/screen-share transport, room metadata | Not configured as a documented region | Cloud/self-hosted entity, media/signaling region/pinning, TURN, logs, retention |
| Desktop app | local settings, caches, drafts, logs/diagnostics | User device location | Stored categories, encryption/OS boundaries, clear/export behavior |
| Backups/exports | database backups, storage copies, user/audit/support exports | Not approved | Region, encryption, retention, restore, legal hold, download controls |
| Support/monitoring | logs, crash/support bundles, alerts | Providers mostly placeholder | Provider region/subprocessors, consent, redaction, retention, access |

## Current Supabase region

The selected project region is not present in `.env` examples or safe renderer configuration and must not be embedded there as an authorization value. Before any production deployment, Operations must independently record the project reference and region from the Supabase project/dashboard/management evidence and have Security/Privacy verify it.

Supabase documents that a project is bound to its selected infrastructure region and changing region requires creating/migrating to another project. This makes region selection an early release decision rather than a harmless environment toggle.

Required record:

| Field | Value |
| --- | --- |
| Environment | staging / production |
| Supabase project ref | restricted inventory |
| Primary region | pending verification |
| Date verified | pending |
| Verifier/approver | pending |
| Read replicas | none/regions pending |
| Edge Function region strategy | pending |
| DPA/subprocessor review | pending |

Official reference: [Supabase project region migration](https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z).

## Storage residency

- Supabase documents the Storage origin as being in the same region as the project, while CDN nodes may cache assets geographically closer to users. CDN caching and provider operations must be included in public/legal residency language.
- Private attachment objects retain community/channel/message RLS boundaries regardless of region.
- CDN/public URLs must not be used to bypass private-channel authorization.
- Object deletion/retention and database attachment metadata must remain coordinated.
- Database backups do not include Storage object bytes; Storage needs its own inventory, replication/backup/restore verification, orphan cleanup, and regional deletion process.
- Thumbnails/quarantine/originals must remain in the same approved storage boundary unless a reviewed regional processing pipeline exists.

Official references: [Supabase Storage CDN origin behavior](https://supabase.com/docs/guides/storage/cdn/fundamentals), [Supabase database backups](https://supabase.com/docs/guides/platform/backups).

## LiveKit region and media path

Voice and screen sharing require a separate residency decision because real-time media/signaling can follow provider routing independent of message storage.

Required decisions:

- LiveKit Cloud versus self-hosted deployment;
- signaling, SFU/media, TURN relay, ingress/egress, logs, analytics, recordings (recording remains out of scope), and support access regions;
- whether project traffic is region-pinned and which plans/contracts enable it;
- failure behavior when the pinned region is unavailable;
- latency/quality impact for users outside the region;
- session/token service execution and data retained after rooms close.

LiveKit documents Cloud region pinning as restricting network traffic to selected geographic regions, with plan/support enablement and reduced automatic cross-region failover. Picom must not claim pinning until enabled and verified with packet/endpoint/provider evidence.

Official reference: [LiveKit Cloud region pinning](https://docs.livekit.io/deploy/admin/regions/region-pinning/).

## Backups and restore

For every production region record:

- provider backup/PITR plan, retention, encryption, region, and access owners;
- whether database backup copies, WAL, support snapshots, and restore jobs remain in the approved geography;
- separate Storage object backup/restore because database backups contain metadata, not object bytes;
- restore-to-new-project limitations and manual reconfiguration for Storage, Edge Functions, Auth settings/API keys, Realtime, and extensions;
- staging restore drill using synthetic or approved protected data;
- backup export destination and cross-border transfer approval;
- deletion/legal-hold behavior across primary, backups, objects, exports, and logs.

Do not call a backup verified until an isolated restore drill checks Auth, communities, channels, messages, roles/permissions, attachments metadata/objects, and audit logs.

## Future regional project model

### Preferred first step: single approved region

Choose one production Supabase project region and compatible LiveKit boundary based on user latency, legal requirements, provider availability, backup/support terms, and operational capacity. This is simpler and safer than speculative multi-region writes.

### Future enterprise regional cells

If customer requirements demand residency, use independent regional deployment cells:

```text
Global control plane (minimal routing/entitlement metadata only)
  -> EU cell: Supabase project + Storage + functions + compatible LiveKit region
  -> US cell: Supabase project + Storage + functions + compatible LiveKit region
  -> additional approved cells
```

Each organization/workspace/community receives one immutable `home_region`/cell before data creation. The desktop resolves a signed, non-secret API configuration for that tenant; it does not choose a region from user-controlled input.

Cell rules:

- one write authority per tenant/community;
- identical migration/RLS/function versions with independent release evidence;
- tenant-scoped Auth strategy decided explicitly (regional users versus minimal global identity broker);
- no cross-region private-data joins;
- Storage, search, realtime, exports, moderation, audit, backups, and LiveKit token/room routing follow home region;
- global presence/feed/discovery use minimal approved metadata or remain unavailable;
- failover cannot silently move data/media outside allowed region.

Read replicas improve read latency/availability but do not create a compliant multi-writer design and may violate geography if placed outside the allowed area.

## Enterprise requirements

Before selling/claiming regional residency, record per organization:

- contractual required/allowed/prohibited regions;
- controller/processor roles, subprocessors, DPA and transfer mechanism;
- organization/workspace/community `home_region` ownership and change authority;
- SSO/SCIM identity metadata region and provisioning path;
- retention, legal hold, export, deletion, audit, backup, and support-access rules;
- LiveKit media/signaling/TURN region and emergency failover consent;
- monitoring/crash/support data region;
- breach/government request/support escalation contacts;
- migration window, downtime, validation, and rollback limitations.

Organization roles and billing owner do not authorize region changes. Region migration requires dedicated permission, step-up authentication, approvals, audit, legal review, and customer communication.

## Region migration procedure

Moving a Supabase project/tenant is a data migration, not an in-place switch:

1. Approve target region/providers/contracts and freeze scope.
2. Inventory database, Auth, Storage objects/settings, Realtime, functions/secrets, integrations, logs, backups, LiveKit rooms, and desktop compatibility.
3. Create target regional project/cell with no production traffic.
4. Apply reviewed migrations/RLS/functions and regenerate types.
5. Transfer/restore database through approved encrypted path; separately copy/verify Storage objects and buckets.
6. Reconfigure Auth providers/redirects, Edge Function secrets, Realtime, rate limits, monitoring, and LiveKit routing.
7. Verify counts/checksums/relationships and cross-tenant RLS in staging/shadow mode.
8. Pause writes or run a proven delta/cutover process; do not allow split-brain.
9. Update remote config/endpoints with client/server version compatibility and rollback window.
10. Smoke Auth, chat, realtime, uploads, private data, voice, exports, deletion, and diagnostics on Windows/Linux/macOS.
11. Monitor and retain source only for the approved rollback/retention period, then securely decommission/audit deletion.

## Migration risks

- Auth UUID/identity/provider mismatch, duplicate accounts, broken OAuth callbacks, or session invalidation
- Storage metadata copied without object bytes, wrong object paths, missing thumbnails, or public ACL regression
- stale DNS/CDN/signed URLs and cross-region cache copies
- write loss/duplication or sequence/idempotency conflict during cutover
- RLS/function/config drift between projects
- realtime clients connected to old project while writes target new project
- LiveKit room split or media outside promised region
- backups/logs/exports/support bundles remaining in old/prohibited region
- desktop clients pinned to old endpoints or below compatible version
- inability to roll database schema/data backward safely
- unexpected downtime, egress cost, latency, provider quota, or legal transfer issue

Any unresolved private-data, completeness, identity, or authorization discrepancy is a migration `No-Go`.

## Monitoring and evidence

Track non-sensitive environment/cell ID, provider-reported region, function execution region, Storage origin/config, LiveKit region/pinning status, backup/restore evidence, migration/RLS version, and endpoint health. Avoid logging user content, tokens, raw IP, signed URLs, or private paths.

Region drift alerts should cover project/replica/function/backup/Storage/LiveKit/support-provider changes. Evidence belongs in restricted operations records, with only safe summaries in app diagnostics.

## Roadmap gates

1. Verify and approve one production Supabase/Storage/LiveKit region inventory.
2. Complete provider/legal/subprocessor/backup/support records and public notice.
3. Run staging restore and native desktop latency/voice/upload tests.
4. Add immutable region metadata only after Organization/Workspace schema is approved.
5. Build regional deployment automation with migration/RLS parity checks.
6. Pilot a new empty enterprise tenant in a second cell.
7. Perform a synthetic region migration drill including Storage and Auth.
8. Independently review security, privacy, availability, and incident/rollback behavior before a residency claim.

## Decision summary

- Current production region: **not verified/configured in repository**.
- Current architecture: **single-project/single-deployment assumption, no residency guarantee**.
- Multi-region routing: **not implemented**.
- Enterprise residency: **blocked on organization model, provider/legal approval, regional deployment cells, backup/Storage/LiveKit evidence, and migration drills**.

