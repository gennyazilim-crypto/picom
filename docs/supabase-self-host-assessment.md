# Supabase self-host migration assessment

## Decision summary

**Recommendation: remain on managed Supabase Cloud for the current Picom stage. Do not migrate now.**

Self-hosting should be reconsidered only when a verified residency/isolation/control requirement cannot be met by managed Supabase and Picom has funded 24/7 ownership for database, Auth, API, Realtime, Storage, Functions, upgrades, security, backup/restore, monitoring, incident response, and capacity.

This assessment adds no cloud resources, Docker/Kubernetes configuration, credentials, networking, schema changes, or runtime behavior.

## Official platform constraints

Supabase's current self-hosting documentation describes Docker as the recommended starting deployment and states that self-hosting resembles one project rather than the managed multi-project platform. It also identifies platform-only capabilities unavailable in self-hosted form, including managed backups/PITR and the platform management API, and assigns provisioning, hardening, updates, Postgres maintenance, HA/scaling, backups/disaster recovery, monitoring, and uptime to the operator.

Managed Supabase projects provide dedicated Postgres plus API, Auth, Functions, Realtime, and Storage. Managed backup/PITR behavior, retention, plan requirements, Storage-object exclusions, and restore downtime must still be verified for Picom's selected plan and release requirements.

Official references:

- [Supabase self-hosting](https://supabase.com/docs/guides/self-hosting)
- [Self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase platform](https://supabase.com/docs/guides/platform)
- [Database backups and PITR](https://supabase.com/docs/guides/platform/backups)
- [Supabase security](https://supabase.com/docs/guides/security)

Capabilities and provider terms must be revalidated at decision time.

## Comparison

| Area | Supabase Cloud | Self-hosted Supabase-compatible stack |
| --- | --- | --- |
| Provisioning/patching | Provider-operated platform plus customer schema/app responsibility | Picom owns hosts, containers/Kubernetes, OS, images, service compatibility and patches |
| Postgres | Managed project database and platform tooling | Picom owns tuning, extensions, vacuum, replication, failover, upgrades and corruption response |
| Backups/PITR | Managed plan-dependent capability; Storage objects require separate protection | Picom designs, encrypts, monitors and restores database plus object backups |
| HA/scaling | Provider offering/plan/SLA | Picom designs multi-AZ, load balancing, failover, capacity, runbooks and tests |
| Auth/keys | Managed Auth configuration; Picom still secures app/session/RLS | Picom owns Auth service configuration, signing-key lifecycle, SMTP/OAuth providers and revocation |
| API/RLS | Managed service; Picom owns schema/policies/tests | Same application responsibility plus service deployment/patching/availability |
| Realtime | Managed service limits/operations | Picom owns WebSocket scaling, replication, presence, backpressure and upgrades |
| Storage | Managed Storage; bucket/RLS/lifecycle still Picom responsibility | Picom owns object backend, gateway, signing, durability, scanning, lifecycle and restore |
| Functions | Managed deployment/runtime constraints | Picom owns Deno/runtime deployment, isolation, networking, scaling and logs |
| Observability/support | Platform status/support/metrics vary by plan | Picom builds complete metrics/logs/traces/alerts/on-call; community support is not an SLA |
| Compliance/control | Provider attestations/DPA/regions subject to contract | Greater placement/control but Picom becomes responsible for evidence and controls |
| Cost | Predictable provider spend and lower staffing burden | Infra plus engineering/on-call/security/compliance and upgrade opportunity cost |

Self-hosting is not automatically cheaper, safer, more private, or more compliant.

## GCP option

Potential architecture (not approved): private VPC, regional multi-zone compute or GKE, managed PostgreSQL only if compatibility/extension/replication requirements are proven, regional object storage, load balancer/WAF, secret manager/KMS, artifact/container registry, monitoring/logging, backup vault, controlled egress and bastion/zero-trust admin access.

Risks:

- mixing managed Cloud SQL with Supabase service assumptions requires compatibility testing;
- GKE adds Kubernetes/security/upgrade burden;
- object/database backup consistency and Storage metadata/object restore are separate;
- regional egress, NAT, load balancers, logs and media can dominate cost;
- Google IAM does not replace Supabase Auth/RLS or Picom tenant permissions.

## Azure option

Potential architecture (not approved): private VNet, regional multi-zone VM scale sets or AKS, managed PostgreSQL only after compatibility proof, Blob Storage, Front Door/Application Gateway/WAF, Key Vault, Container Registry, Monitor/Log Analytics, Backup and restricted admin access.

Risks mirror GCP: AKS/VM and service-version operations, Postgres extension/replication compatibility, Storage restore consistency, networking/egress cost, regional service availability, and identity confusion. Entra/IAM does not replace Picom database authorization.

## Required self-host service inventory

- Postgres and migrations/extensions/RLS
- API gateway/PostgREST
- Auth/GoTrue and SMTP/OAuth/SAML dependencies
- Realtime
- Storage API plus durable object backend
- Functions runtime
- Studio/operator access (never public by default)
- reverse proxy, TLS, WAF/rate limits
- secrets/KMS/signing-key rotation
- logs/metrics/traces/audit/security detection
- database and object backup/restore/PITR strategy
- scanning, thumbnails, jobs/queues, email/webhook dependencies
- regional LiveKit remains a separate system

Every image/version/config combination needs a tested compatibility matrix and controlled upgrade train.

## Backup and disaster recovery

Self-host approval requires:

- encrypted database base backups plus WAL/PITR with off-site/immutable copies;
- separate versioned object backup and metadata/object consistency manifests;
- Auth/signing/config/secret recovery without copying raw secrets into backups/docs;
- defined RPO/RTO, retention, region, deletion/legal-hold behavior;
- automated verification and recurring full restore drills;
- post-restore reconciliation for deleted/anonymized data, revoked sessions/credentials, retention, quarantine and holds;
- corruption, ransomware, operator error and region-loss runbooks.

A backup that has not passed restore and application smoke tests is not a recovery control.

## Upgrade/security ownership

- Track Supabase service images, Postgres major/minor, extensions, Deno/runtime, proxy, OS/container and dependencies.
- Review upstream advisories/changelogs and test migrations/rollback in representative staging.
- Patch critical vulnerabilities under an approved SLA without bypassing compatibility tests.
- Use signed/pinned images, SBOM/license/vulnerability scans, least-privilege identities, network segmentation, secret rotation and break-glass audit.
- Major Postgres/service upgrades need backup verification, rehearsal, maintenance/compatibility plan and rollback limitations.

## Migration outline if reconsidered

1. Approve business/compliance requirement, architecture, staffing, RTO/RPO and total cost.
2. Build disposable staging with synthetic data and exact version inventory.
3. Apply all migrations/RLS and run Auth/API/Realtime/Storage/Functions/private-channel tests.
4. Prove backups, restore, upgrades, failover, monitoring, key rotation and incident response.
5. Build checksummed database/object migration with write-freeze/delta/cutover/rollback design.
6. Test desktop endpoint/auth/session compatibility and old-client behavior.
7. Pilot non-production/internal tenant; independent security review.
8. Only then consider a bounded production migration.

Avoid unreviewed dual-write. Source deletion occurs only after retention/legal/rollback windows.

## Go criteria

- managed Supabase cannot satisfy an approved requirement;
- executive/product/security/legal/operations approve total ownership;
- named staffed on-call and database/security expertise;
- tested HA, backup/restore, upgrade, scaling, monitoring, incident and capacity controls;
- GCP/Azure architecture and cost model approved;
- full staging parity/RLS/security and migration rehearsal;
- provider exit and rollback plan.

## No-go conditions

- motivation is only perceived cost or control without measured evidence;
- no 24/7 owner, DBA/security capability, restore evidence or upgrade process;
- tenant/data-residency/auth design unresolved;
- Storage objects, Realtime, Functions or session migration omitted;
- self-host stack depends on unpinned/manual configuration or secrets in repo;
- current MVP stability/security work would be displaced.

Current result: **No-Go for migration; continue managed Supabase evaluation and close existing production gates first.**
